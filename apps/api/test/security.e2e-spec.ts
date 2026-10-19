// Regresiones de la auditoría de seguridad: OTP atómico, límites de peticiones, sesiones revocables,
// validación de objetos anidados, cupones con la reserva caducada e importe del webhook.
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/passwords.js';
import { configureApp } from '../src/bootstrap.js';
import { CLIENT_IP_HEADER, PROXY_AUTH_HEADER } from '../src/common/client-ip.js';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';
import {
  FAKE_PSP_SIGNATURE_HEADER,
  signFakePspPayload,
} from '../src/payments/fake-psp/fake-psp-signature.js';
import { FakePspService } from '../src/payments/fake-psp/fake-psp.service.js';
import { QrService } from '../src/qr/qr.service.js';
import { OTP_SENDER } from '../src/users/otp-sender.js';

// Este fichero prueba los límites: se activan aunque vitest los desactive para el resto (cada fichero
// de test corre en su propio proceso y el entorno se lee al crear la app).
process.env.RATE_LIMITS = 'on';

const suffix = Date.now().toString(36);
const rnd = () => String(Math.floor(1_000_000 + Math.random() * 8_999_999));
let ipCounter = 0;
/** IP distinta por llamada (rango de documentación), para no compartir contador entre tests. */
const freshIp = () => `198.51.${(ipCounter >> 8) % 256}.${ipCounter++ % 256}`;

const until = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 15_000) => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};

describe('Seguridad (E2E)', () => {
  let app: INestApplication;
  let db: Database;
  let merchantId: string;
  let locationId: string;
  const codes = new Map<string, string>();
  const env = loadEnv();
  const http = () => request(app.getHttpServer());
  /** Petición como si llegara desde Next con la IP `ip` del navegador. */
  const via = <T extends request.Test>(r: T, ip = freshIp()) =>
    r.set(PROXY_AUTH_HEADER, env.INTERNAL_PROXY_SECRET).set(CLIENT_IP_HEADER, ip);

  async function newMerchantUser(role: 'OWNER' | 'STAFF' = 'OWNER') {
    const email = `sec-${role.toLowerCase()}-${rnd()}-${suffix}@e2e.test`;
    const [u] = await db
      .insert(s.merchantUsers)
      .values({ merchantId, email, passwordHash: await hashPassword('secreto123'), role })
      .returning();
    const login = await via(http().post('/v1/merchant/auth/login')).send({
      email,
      password: 'secreto123',
    });
    expect(login.status).toBe(200);
    return { id: u!.id, email, token: login.body.accessToken as string };
  }

  async function newUser() {
    const phone = `+34697${rnd()}`;
    await via(http().post('/v1/auth/otp/start')).send({ phone });
    const ok = await via(http().post('/v1/auth/otp/verify')).send({
      phone,
      code: codes.get(phone),
      consents: { terms: true, marketing: false },
    });
    expect(ok.status).toBe(200);
    return { id: ok.body.user.id as string, token: ok.body.accessToken as string };
  }

  async function tableWithBill(label: string, cents: number) {
    return db.transaction(async (tx) => {
      const [t] = await tx
        .insert(s.tables)
        .values({ locationId, label, externalTableId: label })
        .returning();
      const code = (await app.get(QrService).issueTableQr(tx, { locationId, tableId: t!.id }))
        .shortCode;
      const [bill] = await tx
        .insert(s.fakePosBills)
        .values({ locationId, externalTableId: label })
        .returning();
      await tx
        .insert(s.fakePosBillItems)
        .values({ billId: bill!.id, name: 'Menú', qty: 1, unitPriceCents: cents });
      return code;
    });
  }

  const pay = (body: object, token?: string) => {
    const r = via(http().post('/v1/payment-sessions')).set('Idempotency-Key', `sec-${rnd()}`);
    if (token) r.set('authorization', `Bearer ${token}`);
    return r.send(body);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_SENDER)
      .useValue({ send: async (p: string, c: string) => void codes.set(p, c) })
      .compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app, env);
    await app.listen(0);
    app
      .get(FakePspService)
      .setWebhookTarget(
        `${(await app.getUrl()).replace('[::1]', 'localhost')}/v1/webhooks/psp/fake`,
      );
    db = app.get<Database>(DB);
    const [m] = await db
      .insert(s.merchants)
      .values({
        legalName: 'Seguridad S.L.',
        taxId: 'B77777777',
        brandName: `Seguridad ${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    merchantId = m!.id;
    const [loc] = await db
      .insert(s.merchantLocations)
      .values({
        merchantId,
        name: 'Local seguridad',
        address: 'Calle Segura 1',
        geo: { lng: -3.7, lat: 40.4 },
        category: 'restaurant',
      })
      .returning();
    locationId = loc!.id;
    await db.insert(s.fakePosLocations).values({ locationId, healthy: true });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('OTP', () => {
    // La carrera del código antiguo (comprobar, comparar y borrar por separado) la detecta el test
    // siguiente; este comprueba que una ráfaga desde IPs distintas acaba en bloqueo y quema el código.
    it('una ráfaga de 30 códigos erróneos desde IPs distintas bloquea el número', async () => {
      const phone = `+34696${rnd()}`;
      await via(http().post('/v1/auth/otp/start')).send({ phone });
      const right = codes.get(phone)!;
      const wrong = right === '000001' ? '000002' : '000001';
      const results = await Promise.all(
        Array.from({ length: 30 }, () =>
          via(http().post('/v1/auth/otp/verify')).send({
            phone,
            code: wrong,
            consents: { terms: true, marketing: false },
          }),
        ),
      );
      const byCode = results.map((r) => r.body.code as string);
      expect(byCode.filter((c) => c === 'OTP_INVALID').length).toBeLessThanOrEqual(2);
      expect(byCode.filter((c) => c === 'OTP_BLOCKED').length).toBeGreaterThanOrEqual(28);
      // El código bueno ya no sirve: el número está bloqueado y el código, borrado.
      const late = await via(http().post('/v1/auth/otp/verify')).send({
        phone,
        code: right,
        consents: { terms: true, marketing: false },
      });
      expect(late.body.code).toBe('OTP_BLOCKED');
    });

    it('el mismo código no inicia dos sesiones aunque llegue dos veces a la vez', async () => {
      const phone = `+34695${rnd()}`;
      await via(http().post('/v1/auth/otp/start')).send({ phone });
      const body = { phone, code: codes.get(phone), consents: { terms: true, marketing: false } };
      const results = await Promise.all([
        via(http().post('/v1/auth/otp/verify')).send(body),
        via(http().post('/v1/auth/otp/verify')).send(body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });
  });

  describe('límites de peticiones', () => {
    it('el login del comercio se limita por IP', async () => {
      const ip = freshIp();
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await via(http().post('/v1/merchant/auth/login'), ip).send({
          email: `nadie-${rnd()}@e2e.test`,
          password: 'incorrecta',
        });
        statuses.push(r.status);
      }
      expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
      expect(statuses[10]).toBe(429);
    });

    it('sin el secreto de Next, cambiar la cabecera de IP no evita el límite', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await http()
          .post('/v1/merchant/auth/login')
          .set(CLIENT_IP_HEADER, freshIp())
          .send({ email: `nadie-${rnd()}@e2e.test`, password: 'incorrecta' });
        statuses.push(r.status);
      }
      expect(statuses).toContain(429);
    });

    it('la cuenta se bloquea tras 10 fallos aunque cada intento venga de otra IP', async () => {
      const u = await newMerchantUser();
      for (let i = 0; i < 10; i++) {
        await via(http().post('/v1/merchant/auth/login')).send({
          email: u.email,
          password: 'incorrecta',
        });
      }
      const r = await via(http().post('/v1/merchant/auth/login')).send({
        email: u.email,
        password: 'secreto123',
      });
      expect(r.status).toBe(429);
      expect(r.body.code).toBe('LOGIN_LOCKED');
      // En la auditoría no queda el email en claro.
      const audits = await db.select().from(s.auditLogs);
      expect(JSON.stringify(audits)).not.toContain(u.email);
    });
  });

  describe('sesiones', () => {
    it('cerrar sesión revoca el token del comercio', async () => {
      const u = await newMerchantUser();
      const auth = { authorization: `Bearer ${u.token}` };
      expect((await via(http().get('/v1/merchant/me')).set(auth)).status).toBe(200);
      expect((await via(http().post('/v1/merchant/auth/logout')).set(auth)).status).toBe(204);
      expect((await via(http().get('/v1/merchant/me')).set(auth)).status).toBe(401);
    });

    it('una baja o un cambio de rol se aplican sin esperar a que caduque el token', async () => {
      const u = await newMerchantUser('OWNER');
      const auth = { authorization: `Bearer ${u.token}` };
      await db.update(s.merchantUsers).set({ role: 'STAFF' }).where(eq(s.merchantUsers.id, u.id));
      const promo = await via(http().post('/v1/merchant/promotions'))
        .set(auth)
        .send({ name: 'No debería', discountCents: 500, minSpendCents: 0, validDays: 10 });
      expect(promo.body.code).toBe('FORBIDDEN_ROLE');

      await db
        .update(s.merchantUsers)
        .set({ status: 'DISABLED' })
        .where(eq(s.merchantUsers.id, u.id));
      expect((await via(http().get('/v1/merchant/me')).set(auth)).status).toBe(401);
    });

    it('un token de comensal no vale en el panel ni al revés; un comensal bloqueado pierde la sesión', async () => {
      const user = await newUser();
      const merchant = await newMerchantUser();
      const asUser = { authorization: `Bearer ${user.token}` };
      expect((await via(http().get('/v1/merchant/me')).set(asUser)).status).toBe(401);
      expect(
        (await via(http().get('/v1/me')).set({ authorization: `Bearer ${merchant.token}` })).status,
      ).toBe(401);

      expect((await via(http().get('/v1/me')).set(asUser)).status).toBe(200);
      await db.update(s.users).set({ status: 'BLOCKED' }).where(eq(s.users.id, user.id));
      expect((await via(http().get('/v1/me')).set(asUser)).status).toBe(401);
    });

    it('cerrar sesión revoca el token del comensal', async () => {
      const user = await newUser();
      const auth = { authorization: `Bearer ${user.token}` };
      expect((await via(http().post('/v1/auth/logout')).set(auth)).status).toBe(204);
      expect((await via(http().get('/v1/me')).set(auth)).status).toBe(401);
    });
  });

  describe('validación de objetos anidados', () => {
    it('rechaza consentimientos mal formados antes de gastar el código', async () => {
      const phone = `+34694${rnd()}`;
      await via(http().post('/v1/auth/otp/start')).send({ phone });
      const bad = await via(http().post('/v1/auth/otp/verify')).send({
        phone,
        code: codes.get(phone),
        consents: { terms: true, marketing: false, shareWithMerchantId: 'no-es-un-uuid' },
      });
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      const extra = await via(http().post('/v1/auth/otp/verify')).send({
        phone,
        code: codes.get(phone),
        consents: { terms: true, marketing: false, isAdmin: true },
      });
      expect(extra.status).toBe(400);
    });

    it('rechaza reparto y propina mal formados o con campos de más', async () => {
      const code = await tableWithBill(`V-${rnd()}`, 2_000);
      for (const body of [
        { qrCode: code, tip: { kind: 'percent', value: '10' } },
        { qrCode: code, tip: { kind: 'percent', value: 10 }, split: { mode: 'EQUAL', parts: 1 } },
        { qrCode: code, tip: { kind: 'amount', cents: 0, extra: 1 } },
        { qrCode: code, tip: { kind: 'amount', cents: 0 }, split: { mode: 'NADA' } },
      ]) {
        const r = await pay(body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  it('un cupón con la reserva caducada no se puede usar mientras su pago siga abierto', async () => {
    const user = await newUser();
    const [coupon] = await db
      .insert(s.coupons)
      .values({
        merchantId,
        userId: user.id,
        code: `CC-SEC${rnd()}`,
        title: 'Cupón seguridad',
        discountCents: 500,
        minSpendCents: 0,
        validTo: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const first = await pay(
      {
        qrCode: await tableWithBill(`C1-${rnd()}`, 2_000),
        tip: { kind: 'amount', cents: 0 },
        couponId: coupon!.id,
      },
      user.token,
    );
    expect(first.status).toBe(201);
    // La reserva caduca antes de que el job marque el pago como caducado (o de que el PSP lo cobre).
    await db
      .update(s.coupons)
      .set({ reservedUntil: new Date(Date.now() - 1_000) })
      .where(eq(s.coupons.id, coupon!.id));

    const otherTable = await tableWithBill(`C2-${rnd()}`, 2_000);
    const second = await pay(
      { qrCode: otherTable, tip: { kind: 'amount', cents: 0 }, couponId: coupon!.id },
      user.token,
    );
    expect(second.body.code).toBe('COUPON_UNAVAILABLE');

    // Cuando el primer pago termina sin cobrarse, el cupón vuelve a estar disponible.
    await via(
      http().post(`/v1/payments/${first.body.paymentId}/cancel?t=${first.body.statusToken}`),
    );
    const third = await pay(
      { qrCode: otherTable, tip: { kind: 'amount', cents: 0 }, couponId: coupon!.id },
      user.token,
    );
    expect(third.status).toBe(201);
    expect(third.body.discountCents).toBe(500);
  });

  it('un webhook con un importe distinto del pedido no marca el pago como cobrado', async () => {
    const session = await pay({
      qrCode: await tableWithBill(`W-${rnd()}`, 1_500),
      tip: { kind: 'amount', cents: 0 },
    });
    expect(session.status).toBe(201);
    const sessionId = session.body.checkoutUrl.split('/').pop();
    const webhook = (id: string, amount: number) => {
      const body = JSON.stringify({
        id,
        type: 'payment.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: { session_id: sessionId, amount, charge_id: `ch_${id}` },
      });
      return http()
        .post('/v1/webhooks/psp/fake')
        .set('content-type', 'application/json')
        .set(FAKE_PSP_SIGNATURE_HEADER, signFakePspPayload(env.FAKE_PSP_WEBHOOK_SECRET, body))
        .send(body);
    };
    const status = () =>
      db.query.payments
        .findFirst({ where: eq(s.payments.id, session.body.paymentId) })
        .then((p) => p!.status);

    expect((await webhook(`evt_bad_${suffix}`, 1)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 1_500));
    expect(await status()).toBe('CREATED');

    expect((await webhook(`evt_ok_${suffix}`, 1_500)).status).toBe(200);
    await until(status, (st) => st === 'CAPTURED');
  });

  it('la API envía cabeceras de seguridad y no responde a CORS', async () => {
    const r = await via(http().get('/v1/health')).set('origin', 'https://evil.example');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
});
