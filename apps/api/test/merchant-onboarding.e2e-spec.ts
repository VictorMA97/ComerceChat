// M0: un comercio se registra con doble factor y crea un local con mesas (ROADMAP §3, ADR-025).
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/identity/auth/auth.service.js';
import { hashPassword } from '../src/identity/auth/passwords.js';
import { totp } from '../src/identity/auth/totp.js';
import { configureApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';

describe('M0: registro del comercio con doble factor y alta de local y mesas (E2E)', () => {
  let app: INestApplication;
  let db: Database;
  const suffix = Date.now().toString(36);
  const email = `alta-${suffix}@e2e.test`;
  const password = 'una-clave-larga';
  const http = () => request(app.getHttpServer());
  let secret: string;
  let session: string;
  let recoveryCodes: string[];

  beforeAll(async () => {
    const env = loadEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, env);
    await app.listen(0);
    db = app.get<Database>(DB);
  });

  afterAll(async () => {
    await app?.close();
  });

  const register = () =>
    http()
      .post('/v1/merchant/auth/register')
      .send({
        brandName: `Alta ${suffix}`,
        legalName: 'Alta E2E S.L.',
        taxId: 'B12345678',
        email,
        password,
      });

  it('el registro no abre sesión: obliga a activar el doble factor', async () => {
    const res = await register();
    expect(res.status).toBe(200);
    expect(res.body.step).toBe('MFA_SETUP_REQUIRED');
    // El token intermedio no vale como sesión del panel.
    const me = await http()
      .get('/v1/merchant/me')
      .set('authorization', `Bearer ${res.body.mfaToken}`);
    expect(me.status).toBe(401);

    const setup = await http()
      .post('/v1/merchant/auth/mfa/setup')
      .send({ mfaToken: res.body.mfaToken });
    expect(setup.status).toBe(200);
    expect(setup.body.otpauthUri).toContain(encodeURIComponent(email));
    secret = setup.body.secret;

    const wrong = await http()
      .post('/v1/merchant/auth/mfa/activate')
      .send({ mfaToken: res.body.mfaToken, code: totp(secret) === '000000' ? '111111' : '000000' });
    expect(wrong.body.code).toBe('MFA_CODE_INVALID');

    const ok = await http()
      .post('/v1/merchant/auth/mfa/activate')
      .send({ mfaToken: res.body.mfaToken, code: totp(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCodes).toHaveLength(10);
    session = ok.body.accessToken;
    recoveryCodes = ok.body.recoveryCodes;

    // El token intermedio es de un solo uso.
    const again = await http()
      .post('/v1/merchant/auth/mfa/activate')
      .send({ mfaToken: res.body.mfaToken, code: totp(secret) });
    expect(again.body.code).toBe('MFA_CHALLENGE_INVALID');

    const meOk = await http().get('/v1/merchant/me').set('authorization', `Bearer ${session}`);
    expect(meOk.body).toMatchObject({
      role: 'OWNER',
      mfaEnabled: true,
      merchant: { status: 'ONBOARDING' },
    });
    // El secreto no se guarda en claro.
    const user = await db.query.merchantUsers.findFirst({
      where: eq(s.merchantUsers.email, email),
    });
    expect(user!.mfaSecretEnc).not.toContain(secret);
  });

  it('no deja registrar dos veces el mismo email', async () => {
    expect((await register()).body.code).toBe('EMAIL_TAKEN');
  });

  it('login: la contraseña sola no basta; el código no se puede reutilizar; recuperación de un solo uso', async () => {
    const login = () => http().post('/v1/merchant/auth/login').send({ email, password });
    const first = await login();
    expect(first.body).toMatchObject({ step: 'MFA_REQUIRED' });
    expect(first.body.accessToken).toBeUndefined();

    // El código usado al activar ya no vale (mismo paso de 30 s).
    const replay = await http()
      .post('/v1/merchant/auth/mfa/verify')
      .send({ mfaToken: first.body.mfaToken, code: totp(secret) });
    expect(replay.body.code).toBe('MFA_CODE_INVALID');

    // El del paso siguiente sí (desfase de reloj admitido).
    const ok = await http()
      .post('/v1/merchant/auth/mfa/verify')
      .send({ mfaToken: first.body.mfaToken, code: totp(secret, Date.now() + 30_000) });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    const second = await login();
    const recovery = await http()
      .post('/v1/merchant/auth/mfa/verify')
      .send({ mfaToken: second.body.mfaToken, recoveryCode: recoveryCodes[0]!.toUpperCase() });
    expect(recovery.status).toBe(200);
    const third = await login();
    const reused = await http()
      .post('/v1/merchant/auth/mfa/verify')
      .send({ mfaToken: third.body.mfaToken, recoveryCode: recoveryCodes[0] });
    expect(reused.body.code).toBe('MFA_CODE_INVALID');
  });

  it('bloquea la cuenta tras 5 códigos incorrectos', async () => {
    const merchant = await db.query.merchantUsers.findFirst({
      where: eq(s.merchantUsers.email, email),
    });
    const lockedEmail = `bloqueo-${suffix}@e2e.test`;
    await db.insert(s.merchantUsers).values({
      merchantId: merchant!.merchantId,
      email: lockedEmail,
      passwordHash: await hashPassword(password),
      role: 'MANAGER',
    });
    const login = await http()
      .post('/v1/merchant/auth/login')
      .send({ email: lockedEmail, password });
    // Un MANAGER sin doble factor solo puede activarlo.
    expect(login.body.step).toBe('MFA_SETUP_REQUIRED');
    await http().post('/v1/merchant/auth/mfa/setup').send({ mfaToken: login.body.mfaToken });
    const codes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await http()
        .post('/v1/merchant/auth/mfa/activate')
        .send({ mfaToken: login.body.mfaToken, code: '000000' });
      codes.push(r.body.code);
    }
    expect(codes.slice(0, 5)).toEqual(Array(5).fill('MFA_CODE_INVALID'));
    expect(codes[5]).toBe('MFA_LOCKED');
  });

  it('una sesión de OWNER sin doble factor (anterior a M0) ya no vale', async () => {
    const merchant = await db.query.merchantUsers.findFirst({
      where: eq(s.merchantUsers.email, email),
    });
    const [legacy] = await db
      .insert(s.merchantUsers)
      .values({
        merchantId: merchant!.merchantId,
        email: `legacy-${suffix}@e2e.test`,
        passwordHash: await hashPassword(password),
        role: 'OWNER',
      })
      .returning();
    const { accessToken } = await app.get(AuthService).issueSession({
      merchantUserId: legacy!.id,
      merchantId: legacy!.merchantId,
      role: 'OWNER',
    });
    const me = await http().get('/v1/merchant/me').set('authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('crea un local con mesas y QR; los QR funcionan cuando el comercio completa el alta en el PSP', async () => {
    const auth = { authorization: `Bearer ${session}` };
    const created = await http().post('/v1/merchant/locations').set(auth).send({
      name: 'Local nuevo',
      address: 'Calle de Argumosa 1, 28012 Madrid',
      category: 'bar',
      lat: 40.4087,
      lng: -3.6996,
      tableCount: 3,
    });
    expect(created.status).toBe(201);
    const more = await http()
      .post(`/v1/merchant/locations/${created.body.id}/tables`)
      .set(auth)
      .send({ count: 2, capacity: 6 });
    expect(more.status).toBe(204);

    const list = await http().get('/v1/merchant/locations').set(auth);
    const loc = list.body.find((l: { id: string }) => l.id === created.body.id);
    expect(loc.tables.map((t: { label: string }) => t.label)).toEqual([
      'Mesa 1',
      'Mesa 2',
      'Mesa 3',
      'Mesa 4',
      'Mesa 5',
    ]);
    expect(loc.tables.every((t: { qr: unknown }) => t.qr)).toBe(true);
    const code = loc.tables[0].qr.shortCode as string;

    // Sin alta en el PSP el comercio no cobra.
    expect((await http().get(`/v1/qr/${code}`)).body.code).toBe('MERCHANT_UNAVAILABLE');
    const kyb = await http().post('/v1/merchant/psp/onboarding/simulate').set(auth);
    expect(kyb.status).toBe(204);

    // La caché de resolución guarda el «no disponible» unos segundos; la mesa 2 no se ha consultado.
    const qr = await http().get(`/v1/qr/${loc.tables[1].qr.shortCode}`);
    expect(qr.status).toBe(200);
    expect(qr.body).toMatchObject({
      table: { label: 'Mesa 2' },
      location: { name: 'Local nuevo' },
    });

    // El simulador de caja tiene el local con su carta y enlaza las mesas nuevas.
    const pos = await http().get('/v1/merchant/fake-pos').set(auth);
    const posLoc = pos.body.find((l: { locationId: string }) => l.locationId === created.body.id);
    expect(posLoc.menu.length).toBeGreaterThan(0);
    expect(posLoc.tables.every((t: { externalTableId: string | null }) => t.externalTableId)).toBe(
      true,
    );
  });

  it('valida los datos del local', async () => {
    const res = await http()
      .post('/v1/merchant/locations')
      .set('authorization', `Bearer ${session}`)
      .send({ name: 'X', address: 'Calle', category: 'disco', lat: 200, lng: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('registro de actividad: solo el OWNER lo ve, paginado y de solo inserción (ADR-028)', async () => {
    const auth = { authorization: `Bearer ${session}` };
    type Entry = { action: string; actor: { email: string | null }; id: string };
    const expected = [
      'merchant.registered',
      'merchant_user.mfa_enabled',
      'merchant_user.mfa_failed',
      'merchant_user.mfa_recovery_code_used',
      'merchant_user.login',
      'location.created',
      'tables.created',
      'merchant.psp_onboarding_simulated',
    ];
    const readAll = async () => {
      const all: Entry[] = [];
      let cursor: string | null = null;
      do {
        const res: request.Response = await http()
          .get(`/v1/merchant/audit?limit=5${cursor ? `&before=${cursor}` : ''}`)
          .set(auth);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeLessThanOrEqual(5);
        all.push(...res.body.items);
        cursor = res.body.nextCursor;
      } while (cursor);
      return all;
    };
    // Las entradas llegan a audit por AuditRecorded.v1 (ADR-029): se espera a que estén todas.
    let all: Entry[] = [];
    for (let i = 0; i < 100; i++) {
      all = await readAll();
      if (expected.every((a) => all.some((e) => e.action === a))) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const actions = all.map((e) => e.action);
    for (const a of expected) {
      expect(actions).toContain(a);
    }
    // De la más reciente a la más antigua, sin repetidos entre páginas.
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect([...all.map((e) => e.id)].sort().reverse()).toEqual(all.map((e) => e.id));
    expect(all.find((e) => e.action === 'merchant.registered')!.actor.email).toBe(email);

    // Otros comercios no aparecen.
    const foreign = await db
      .select()
      .from(s.auditLogs)
      .where(eq(s.auditLogs.action, 'merchant_user.login'));
    const mine = new Set(all.map((e) => e.id));
    expect(foreign.some((r) => !mine.has(r.id))).toBe(true);

    // La base de datos impide corregir o borrar entradas.
    await expect(
      db.update(s.auditLogs).set({ action: 'x' }).where(eq(s.auditLogs.id, all[0]!.id)),
    ).rejects.toThrow();
    await expect(db.delete(s.auditLogs).where(eq(s.auditLogs.id, all[0]!.id))).rejects.toThrow();
  });

  it('un MANAGER no ve el registro de actividad', async () => {
    const merchant = await db.query.merchantUsers.findFirst({
      where: eq(s.merchantUsers.email, email),
    });
    const [manager] = await db
      .insert(s.merchantUsers)
      .values({
        merchantId: merchant!.merchantId,
        email: `manager-${suffix}@e2e.test`,
        passwordHash: await hashPassword(password),
        role: 'MANAGER',
      })
      .returning();
    // Sesión emitida directamente: aquí se prueba el rol, no el login.
    await db
      .update(s.merchantUsers)
      .set({ mfaEnabled: true })
      .where(eq(s.merchantUsers.id, manager!.id));
    const { accessToken } = await app.get(AuthService).issueSession({
      merchantUserId: manager!.id,
      merchantId: manager!.merchantId,
      role: 'MANAGER',
    });
    const res = await http()
      .get('/v1/merchant/audit')
      .set('authorization', `Bearer ${accessToken}`);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });
});
