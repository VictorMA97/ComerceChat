// P3: dividir la cuenta con varios pagadores a la vez, webhooks en modo caos, tiempo real,
// QR de cobro de la caja y vista de sala (ROADMAP §2, P3; SPEC §3.3 criterios 2, 3 y 5).
import 'reflect-metadata';
process.env.FAKE_PSP_CHAOS = 'on';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { RealtimeEvent } from '@comercechat/shared-types';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/passwords.js';
import { configureApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';
import { FakePspService } from '../src/payments/fake-psp/fake-psp.service.js';
import { QrService } from '../src/qr/qr.service.js';
import { RealtimeService } from '../src/realtime/realtime.service.js';

const suffix = Date.now().toString(36);

const until = async <T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs = 40_000,
): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() - start > timeoutMs)
      throw new Error(`Timeout; último valor: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
};

describe('P3: dividir la cuenta, tiempo real y QR de cobro de la caja (E2E)', () => {
  let app: INestApplication;
  let db: Database;
  let locationId: string;
  let token: string;
  const http = () => request(app.getHttpServer());

  async function tableWithBill(label: string, items: [string, number, number][]) {
    const qrService = app.get(QrService);
    return db.transaction(async (tx) => {
      const [t] = await tx
        .insert(s.tables)
        .values({ locationId, label, externalTableId: label })
        .returning();
      const code = (await qrService.issueTableQr(tx, { locationId, tableId: t!.id })).shortCode;
      const [bill] = await tx
        .insert(s.fakePosBills)
        .values({ locationId, externalTableId: label })
        .returning();
      await tx.insert(s.fakePosBillItems).values(
        items.map(([name, qty, unitPriceCents]) => ({
          billId: bill!.id,
          name,
          qty,
          unitPriceCents,
        })),
      );
      return { code, tableId: t!.id, billId: bill!.id };
    });
  }

  const pay = (body: object, key: string) =>
    http().post('/v1/payment-sessions').set('Idempotency-Key', key).send(body);
  const sessionIdOf = (checkoutUrl: string) => checkoutUrl.split('/').pop()!;
  const complete = (checkoutUrl: string, outcome = 'succeed') =>
    http()
      .post(`/v1/fake-psp/sessions/${sessionIdOf(checkoutUrl)}/complete`)
      .send({ outcome });
  const bill = (code: string) =>
    http()
      .get(`/v1/qr/${code}/bill`)
      .then((r) => r.body);

  beforeAll(async () => {
    const env = loadEnv();
    expect(env.FAKE_PSP_CHAOS).toBe('on');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
        legalName: 'Split S.L.',
        taxId: 'B77777777',
        brandName: `Split ${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    const [loc] = await db
      .insert(s.merchantLocations)
      .values({
        merchantId: m!.id,
        name: 'Local split',
        address: 'Calle Split 1',
        geo: { lng: -3.7, lat: 40.4 },
        category: 'restaurant',
      })
      .returning();
    locationId = loc!.id;
    await db.insert(s.fakePosLocations).values({ locationId, healthy: true });
    await db.insert(s.merchantUsers).values({
      merchantId: m!.id,
      email: `split-${suffix}@e2e.test`,
      passwordHash: await hashPassword('secreto123'),
      role: 'STAFF',
    });
    token = (
      await http()
        .post('/v1/merchant/auth/login')
        .send({ email: `split-${suffix}@e2e.test`, password: 'secreto123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('4 pagadores simultáneos por platos: nadie paga dos veces el mismo plato (criterio 2)', async () => {
    const t = await tableWithBill('S1', [
      ['Caña', 2, 250],
      ['Bravas', 1, 650],
      ['Croquetas', 1, 900],
      ['Tarta', 1, 600],
    ]);
    const { bill: b } = await bill(t.code);
    const line = (name: string) => b.lines.find((l: { name: string }) => l.name === name).lineId;

    // Dos comensales quieren las mismas bravas a la vez; los otros dos, platos distintos.
    const wants = [
      [
        { lineId: line('Bravas'), units: 1 },
        { lineId: line('Caña'), units: 1 },
      ],
      [
        { lineId: line('Bravas'), units: 1 },
        { lineId: line('Caña'), units: 1 },
      ],
      [{ lineId: line('Croquetas'), units: 1 }],
      [{ lineId: line('Tarta'), units: 1 }],
    ];
    const results = await Promise.all(
      wants.map((items, i) =>
        pay(
          { qrCode: t.code, split: { mode: 'ITEMS', items }, tip: { kind: 'percent', value: 10 } },
          `items-${suffix}-${i}`,
        ),
      ),
    );
    const ok = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status !== 201);
    expect(ok).toHaveLength(3);
    expect(rejected.map((r) => r.body.code)).toEqual(['ITEMS_UNAVAILABLE']);

    // El que perdió las bravas paga la otra caña y nada más.
    const retry = await pay(
      {
        qrCode: t.code,
        split: { mode: 'ITEMS', items: [{ lineId: line('Caña'), units: 1 }] },
        tip: { kind: 'amount', cents: 0 },
      },
      `items-${suffix}-retry`,
    );
    expect(retry.status).toBe(201);
    expect((await bill(t.code)).bill).toMatchObject({ availableCents: 0, reservedCents: 2_650 });

    // Pagan los 4 a la vez; los webhooks llegan retrasados, duplicados y desordenados (modo caos).
    await Promise.all([...ok, retry].map((r) => complete(r.body.checkoutUrl)));
    await until(
      () => db.select().from(s.fakePosBills).where(eq(s.fakePosBills.id, t.billId)),
      ([row]) => row?.status === 'CLOSED',
    );
    const posPayments = await db
      .select()
      .from(s.fakePosPayments)
      .where(eq(s.fakePosPayments.billId, t.billId));
    expect(posPayments).toHaveLength(4);
    expect(posPayments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(2_650);
    const ids = [...ok, retry].map((r) => r.body.paymentId as string);
    const txs = await db
      .select()
      .from(s.transactions)
      .where(inArray(s.transactions.paymentId, ids));
    expect(txs.filter((x) => x.type === 'CHARGE')).toHaveLength(4);
  }, 90_000);

  it('a partes iguales: 3 partes de 65,60 € cubren el total exacto aunque se paguen a la vez', async () => {
    const t = await tableWithBill('S2', [
      ['Menú', 2, 2_000],
      ['Vino', 1, 2_560],
    ]);
    const results = await Promise.all(
      [0, 1, 2].map((i) =>
        pay(
          {
            qrCode: t.code,
            split: { mode: 'EQUAL', parts: 3, shares: 1 },
            tip: { kind: 'amount', cents: 0 },
          },
          `eq-${suffix}-${i}`,
        ),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(results.map((r) => r.body.amountCents).sort()).toEqual([2_186, 2_187, 2_187]);
    const fourth = await pay(
      {
        qrCode: t.code,
        split: { mode: 'EQUAL', parts: 3, shares: 1 },
        tip: { kind: 'amount', cents: 0 },
      },
      `eq-${suffix}-3`,
    );
    expect(fourth.body.code).toBe('PAYMENT_IN_PROGRESS');
  });

  it('por importe: no deja reservar más de lo que queda', async () => {
    const t = await tableWithBill('S3', [['Cena', 1, 5_000]]);
    const results = await Promise.all(
      [3_000, 3_000].map((amountCents, i) =>
        pay(
          {
            qrCode: t.code,
            split: { mode: 'AMOUNT', amountCents },
            tip: { kind: 'amount', cents: 0 },
          },
          `amt-${suffix}-${i}`,
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('SPLIT_AMOUNT_TOO_HIGH');
  });

  it('el mismo dispositivo que reintenta libera su intento anterior; cancelar libera la parte', async () => {
    const t = await tableWithBill('S4', [['Comida', 1, 2_000]]);
    const guest = `guest-${suffix}-0000000001`;
    const first = await pay(
      {
        qrCode: t.code,
        split: { mode: 'FULL' },
        tip: { kind: 'amount', cents: 0 },
        guestSessionId: guest,
      },
      `g-${suffix}-1`,
    );
    const second = await pay(
      {
        qrCode: t.code,
        split: { mode: 'FULL' },
        tip: { kind: 'amount', cents: 0 },
        guestSessionId: guest,
      },
      `g-${suffix}-2`,
    );
    expect(second.status).toBe(201);
    const old = await http().get(
      `/v1/payments/${first.body.paymentId}?t=${first.body.statusToken}`,
    );
    expect(old.body).toMatchObject({ status: 'FAILED', failureReason: 'SUPERSEDED' });
    // Otro dispositivo no puede pagar lo mismo mientras tanto…
    const other = await pay(
      {
        qrCode: t.code,
        split: { mode: 'FULL' },
        tip: { kind: 'amount', cents: 0 },
        guestSessionId: `guest-${suffix}-0000000002`,
      },
      `g-${suffix}-3`,
    );
    expect(other.body.code).toBe('PAYMENT_IN_PROGRESS');
    // …hasta que el primero cancela.
    const cancel = await http().post(
      `/v1/payments/${second.body.paymentId}/cancel?t=${second.body.statusToken}`,
    );
    expect(cancel.body.failureReason).toBe('CANCELLED_BY_PAYER');
    expect((await bill(t.code)).bill.availableCents).toBe(2_000);
  });

  it('avisa en tiempo real a la mesa cuando cambia la cuenta (SSE)', async () => {
    const t = await tableWithBill('S5', [['Café', 2, 180]]);
    const realtime = app.get(RealtimeService);
    const received: RealtimeEvent[] = [];
    const sub = realtime
      .stream((e) => e.tableId === t.tableId)
      .subscribe((m) => {
        if (m.type !== 'ping') received.push(m.data as RealtimeEvent);
      });
    const session = await pay(
      { qrCode: t.code, split: { mode: 'FULL' }, tip: { kind: 'amount', cents: 0 } },
      `rt-${suffix}`,
    );
    const t0 = Date.now();
    await complete(session.body.checkoutUrl);
    await until(
      async () => received.map((e) => e.reason),
      (r) => r.includes('bill.closed'),
      20_000,
    );
    sub.unsubscribe();
    expect(received.map((e) => e.reason)).toEqual(
      expect.arrayContaining(['payment.started', 'payment.captured', 'bill.closed']),
    );
    // En modo caos el webhook puede tardar hasta 10 s: el criterio 5 (< 3 s) se mide sin caos en el navegador.
    expect(Date.now() - t0).toBeLessThan(15_000);

    // El endpoint SSE responde con text/event-stream.
    const res = await fetch(
      `${(await app.getUrl()).replace('[::1]', 'localhost')}/v1/qr/${t.code}/events`,
      {
        signal: AbortSignal.timeout(1_000),
      },
    ).catch(() => null);
    expect(res?.headers.get('content-type')).toContain('text/event-stream');
    await res?.body?.cancel().catch(() => undefined);
  }, 30_000);

  it('vista de sala: estado de las mesas y propinas del día', async () => {
    const res = await http().get('/v1/merchant/floor').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tables = res.body[0].tables as {
      label: string;
      status: string;
      tipsTodayCents: number;
    }[];
    expect(tables.find((x) => x.label === 'S1')).toMatchObject({ status: 'PAID' });
    expect(tables.find((x) => x.label === 'S3')).toMatchObject({ status: 'PAYING' });
    expect(res.body[0].tipsTodayCents).toBeGreaterThan(0);
  });

  it('QR de cobro de la caja: por lo pendiente, un solo pago y registrado en la mesa', async () => {
    const t = await tableWithBill('S6', [['Menú del día', 1, 1_250]]);
    const created = await http()
      .post(`/v1/merchant/tables/${t.tableId}/payment-qr`)
      .set('authorization', `Bearer ${token}`);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      amountCents: 1_250,
      tableId: t.tableId,
      status: 'ACTIVE',
    });
    const dynamicToken = created.body.url.split('/d/')[1];
    expect((await http().get(`/v1/qr/dynamic/${dynamicToken}`)).body).toMatchObject({
      amountCents: 1_250,
      table: { label: 'S6' },
    });

    // El simulador de caja muestra el QR en la tarjeta de la mesa.
    const pos = await http().get('/v1/merchant/fake-pos').set('authorization', `Bearer ${token}`);
    const posTable = pos.body[0].tables.find((x: { tableLabel: string }) => x.tableLabel === 'S6');
    expect(posTable.paymentQr).toMatchObject({ id: created.body.id, status: 'ACTIVE' });

    // Dos personas lo escanean a la vez: solo una puede pagarlo.
    const [a, b] = await Promise.all([
      pay(
        {
          dynamicToken,
          tip: { kind: 'percent', value: 10 },
          guestSessionId: `guest-${suffix}-0000000003`,
        },
        `dq-${suffix}-a`,
      ),
      pay(
        {
          dynamicToken,
          tip: { kind: 'percent', value: 10 },
          guestSessionId: `guest-${suffix}-0000000004`,
        },
        `dq-${suffix}-b`,
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const winner = a.status === 201 ? a : b;
    expect(winner.body).toMatchObject({ amountCents: 1_250, tipCents: 125, splitMode: 'POS_QR' });

    await complete(winner.body.checkoutUrl);
    const view = await until(
      () =>
        http()
          .get(`/v1/merchant/dynamic-qr/${created.body.id}`)
          .set('authorization', `Bearer ${token}`)
          .then((r) => r.body),
      (v) => v.status === 'CONSUMED',
    );
    expect(view.payment.status).toBe('CAPTURED');
    // El pago se registra en la cuenta de la mesa y la cierra.
    await until(
      () => db.select().from(s.fakePosBills).where(eq(s.fakePosBills.id, t.billId)),
      ([row]) => row?.status === 'CLOSED',
    );
    const posPayments = await db
      .select()
      .from(s.fakePosPayments)
      .where(eq(s.fakePosPayments.billId, t.billId));
    expect(posPayments).toMatchObject([{ amountCents: 1_250, tipCents: 125 }]);
    expect((await http().get(`/v1/qr/dynamic/${dynamicToken}`)).body.code).toBe('QR_INVALID');

    // Un importe manipulado en el token no vale.
    const [h, p, sig] = dynamicToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), amountCents: 1 }),
    ).toString('base64url');
    expect((await http().get(`/v1/qr/dynamic/${h}.${forged}.${sig}`)).status).toBe(404);
  }, 40_000);

  it('QR de cobro de la caja con comensales pagando desde el móvil: nunca se cobra de más', async () => {
    const t = await tableWithBill('S7', [['Cena', 1, 2_000]]);
    // Un comensal ya está pagando 5 € desde su móvil: el QR de la caja sale por los 15 € restantes.
    await pay(
      {
        qrCode: t.code,
        split: { mode: 'AMOUNT', amountCents: 500 },
        tip: { kind: 'amount', cents: 0 },
      },
      `s7-${suffix}-1`,
    );
    const created = await http()
      .post(`/v1/merchant/tables/${t.tableId}/payment-qr`)
      .set('authorization', `Bearer ${token}`);
    expect(created.body.amountCents).toBe(1_500);

    // Otro comensal paga 3 € por su cuenta: el QR de 15 € ya no cabe y se rechaza.
    await pay(
      {
        qrCode: t.code,
        split: { mode: 'AMOUNT', amountCents: 300 },
        tip: { kind: 'amount', cents: 0 },
      },
      `s7-${suffix}-2`,
    );
    const dynamicToken = created.body.url.split('/d/')[1];
    const outdated = await pay(
      { dynamicToken, tip: { kind: 'amount', cents: 0 } },
      `s7-${suffix}-3`,
    );
    expect(outdated.body.code).toBe('PAYMENT_QR_OUTDATED');

    // Al generar uno nuevo, el anterior queda anulado y el nuevo va por lo que queda (12 €).
    const again = await http()
      .post(`/v1/merchant/tables/${t.tableId}/payment-qr`)
      .set('authorization', `Bearer ${token}`);
    expect(again.body.amountCents).toBe(1_200);
    expect((await http().get(`/v1/qr/dynamic/${dynamicToken}`)).body.code).toBe('QR_INVALID');
  });
});
