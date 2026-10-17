// Prueba E2E contra Postgres y Redis reales (DATABASE_URL / REDIS_URL de .env.local).
// Crea su propio comercio con emails únicos, así que no interfiere con los datos de `pnpm db:seed`.
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/passwords.js';
import { configureApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';
import { QrService } from '../src/qr/qr.service.js';

describe('Comercio: autenticación, mesas y QR (E2E)', () => {
  let app: INestApplication;
  const suffix = Date.now().toString(36);
  const owner = `owner-${suffix}@e2e.test`;
  const staff = `staff-${suffix}@e2e.test`;
  let tableId: string;
  let shortCode: string;

  beforeAll(async () => {
    const env = loadEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, env);
    // Servidor escuchando en un puerto efímero: evita que supertest abra y cierre uno por petición.
    await app.listen(0);

    const db = app.get<Database>(DB);
    const qrService = app.get(QrService);
    const passwordHash = await hashPassword('secreto123');
    await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(s.merchants)
        .values({ legalName: 'E2E S.L.', taxId: 'B99999999', brandName: `E2E ${suffix}`, status: 'ACTIVE' })
        .returning();
      await tx.insert(s.merchantUsers).values([
        { merchantId: m!.id, email: owner, passwordHash, role: 'OWNER' },
        { merchantId: m!.id, email: staff, passwordHash, role: 'STAFF' },
      ]);
      const [loc] = await tx
        .insert(s.merchantLocations)
        .values({
          merchantId: m!.id,
          name: 'Local E2E',
          address: 'Calle de Prueba 1, Madrid',
          geo: { lng: -3.7, lat: 40.42 },
          category: 'restaurant',
        })
        .returning();
      const [t] = await tx.insert(s.tables).values({ locationId: loc!.id, label: 'Mesa 1' }).returning();
      tableId = t!.id;
      const qr = await qrService.issueTableQr(tx, { locationId: loc!.id, tableId });
      shortCode = qr.shortCode;
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const login = async (email: string) =>
    (await request(app.getHttpServer()).post('/v1/merchant/auth/login').send({ email, password: 'secreto123' }))
      .body.accessToken as string;

  it('rechaza credenciales incorrectas con problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/merchant/auth/login')
      .send({ email: owner, password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('lista las mesas del comercio con su QR activo', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/merchant/locations')
      .set('authorization', `Bearer ${await login(owner)}`);
    expect(res.status).toBe(200);
    expect(res.body[0].tables[0]).toMatchObject({ id: tableId, qr: { shortCode, status: 'ACTIVE' } });
  });

  it('resuelve el QR público con la identidad del comercio', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/qr/${shortCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ merchant: { brandName: `E2E ${suffix}` }, table: { label: 'Mesa 1' } });
  });

  it('impide a STAFF regenerar QR', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/merchant/tables/${tableId}/qr/regenerate`)
      .set('authorization', `Bearer ${await login(staff)}`);
    expect(res.status).toBe(403);
  });

  it('al regenerar, el QR anterior deja de funcionar al momento', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/merchant/tables/${tableId}/qr/regenerate`)
      .set('authorization', `Bearer ${await login(owner)}`);
    expect(res.status).toBe(201);
    expect(res.body.shortCode).not.toBe(shortCode);

    expect((await request(app.getHttpServer()).get(`/v1/qr/${shortCode}`)).body.code).toBe('QR_INVALID');
    expect((await request(app.getHttpServer()).get(`/v1/qr/${res.body.shortCode}`)).status).toBe(200);
  });
});
