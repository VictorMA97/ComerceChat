// Flujo de pago de P2 de extremo a extremo con Postgres, Redis y colas reales (ROADMAP §2, P2).
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';
import {
  FAKE_PSP_SIGNATURE_HEADER,
  signFakePspPayload,
} from '../src/payments/fake-psp/fake-psp-signature.js';
import { FakePspService } from '../src/payments/fake-psp/fake-psp.service.js';
import { QrService } from '../src/qr/qr.service.js';

const suffix = Date.now().toString(36);
const guest = `guest-p2-${suffix}-000000`;

const until = async <T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs = 15_000,
): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() - start > timeoutMs)
      throw new Error(`Timeout esperando condición; último valor: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};

describe('Pago de la cuenta de una mesa (E2E)', () => {
  let app: INestApplication;
  let db: Database;
  let locationId: string;
  const qr = { full: '', dup: '', decline: '' };
  const http = () => request(app.getHttpServer());

  /** Mesa enlazada con la caja simulada y con una cuenta abierta. */
  async function tableWithBill(label: string, items: [string, number, number][]): Promise<string> {
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
      return code;
    });
  }

  const createSession = (code: string, tipCents: number, key = `k-${code}-${tipCents}`) =>
    http()
      .post('/v1/payment-sessions')
      .set('Idempotency-Key', key)
      // Mismo dispositivo en todo el fichero: un nuevo intento sustituye al anterior (ADR-022).
      .send({ qrCode: code, tip: { kind: 'amount', cents: tipCents }, guestSessionId: guest });

  const receipt = (id: string, token: string) => http().get(`/v1/payments/${id}?t=${token}`);

  beforeAll(async () => {
    const env = loadEnv();
    expect(env.QUEUE_PREFIX).toMatch(/^cc-test-/);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app, env);
    await app.listen(0);
    app
      .get(FakePspService)
      .setWebhookTarget(`${await app.getUrl()}/v1/webhooks/psp/fake`.replace('[::1]', 'localhost'));
    db = app.get<Database>(DB);

    const [m] = await db
      .insert(s.merchants)
      .values({
        legalName: 'Pagos E2E S.L.',
        taxId: 'B88888888',
        brandName: `Bar Pagos ${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    const [loc] = await db
      .insert(s.merchantLocations)
      .values({
        merchantId: m!.id,
        name: 'Local pagos',
        address: 'Calle Falsa 1, Madrid',
        geo: { lng: -3.7, lat: 40.4 },
        category: 'restaurant',
      })
      .returning();
    locationId = loc!.id;
    await db.insert(s.fakePosLocations).values({ locationId, healthy: true });

    qr.full = await tableWithBill('P1', [
      ['Caña', 2, 1_000],
      ['Bravas', 1, 550],
    ]);
    qr.dup = await tableWithBill('P2', [['Vermut', 1, 350]]);
    qr.decline = await tableWithBill('P3', [['Tortilla', 1, 850]]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('muestra la cuenta de la mesa con lo pendiente', async () => {
    const res = await http().get(`/v1/qr/${qr.full}/bill`);
    expect(res.status).toBe(200);
    expect(res.body.bill).toMatchObject({ totalCents: 2_550, paidCents: 0, pendingCents: 2_550 });
    expect(res.body.bill.lines).toHaveLength(2);
    expect(res.body.tips.percentages).toEqual([0, 5, 10]);
  });

  it('exige Idempotency-Key y la respeta', async () => {
    const missing = await http()
      .post('/v1/payment-sessions')
      .send({ qrCode: qr.full, tip: { kind: 'amount', cents: 0 } });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const first = await createSession(qr.full, 255, `idem-1-${suffix}`);
    expect(first.status).toBe(201);
    const replay = await createSession(qr.full, 255, `idem-1-${suffix}`);
    expect(replay.body.paymentId).toBe(first.body.paymentId);
    const reused = await createSession(qr.full, 100, `idem-1-${suffix}`);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('cobra la cuenta, la registra en la caja y la cierra', async () => {
    const session = await createSession(qr.full, 255, `idem-2-${suffix}`);
    expect(session.body).toMatchObject({ amountCents: 2_550, tipCents: 255 });
    const sessionId = session.body.checkoutUrl.split('/').pop();

    // La sesión de la prueba anterior (idem-1, mismo dispositivo) queda sustituida por esta.
    const done = await http()
      .post(`/v1/fake-psp/sessions/${sessionId}/complete`)
      .send({ outcome: 'succeed' });
    expect(done.status).toBe(200);
    expect(done.body.returnUrl).toContain(`/p/${session.body.paymentId}?t=`);

    const captured = await until(
      () => receipt(session.body.paymentId, session.body.statusToken).then((r) => r.body),
      (b) => b.status === 'CAPTURED',
    );
    expect(captured).toMatchObject({
      totalCents: 2_805,
      tipCents: 255,
      method: 'CARD',
      cardLast4: '4242',
    });

    const bill = await until(
      () =>
        http()
          .get(`/v1/qr/${qr.full}/bill`)
          .then((r) => r.body.bill),
      (b) => b === null,
    );
    expect(bill).toBeNull();
    const posPayments = await db
      .select()
      .from(s.fakePosPayments)
      .where(eq(s.fakePosPayments.reference, session.body.paymentId));
    expect(posPayments).toMatchObject([{ amountCents: 2_550, tipCents: 255 }]);
    const txs = await db
      .select()
      .from(s.transactions)
      .where(eq(s.transactions.paymentId, session.body.paymentId));
    expect(txs.map((t) => t.type).sort()).toEqual(['CHARGE', 'FEE']);

    const nothing = await createSession(qr.full, 0, `idem-3-${suffix}`);
    expect(nothing.body.code).toBe('NOTHING_TO_PAY');
  });

  it('un webhook repetido 10 veces produce un solo cobro (SPEC §3.3, criterio 3)', async () => {
    const session = await createSession(qr.dup, 0);
    const sessionId = session.body.checkoutUrl.split('/').pop();
    const body = JSON.stringify({
      id: `evt_dup_${suffix}`,
      type: 'payment.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        session_id: sessionId,
        amount: 350,
        charge_id: `fch_dup_${suffix}`,
        method: 'CARD',
        card_last4: '4242',
        psp_fee: 20,
      },
    });
    const signature = signFakePspPayload(loadEnv().FAKE_PSP_WEBHOOK_SECRET, body);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        http()
          .post('/v1/webhooks/psp/fake')
          .set('content-type', 'application/json')
          .set(FAKE_PSP_SIGNATURE_HEADER, signature)
          .send(body),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));

    await until(
      () => db.query.payments.findFirst({ where: eq(s.payments.id, session.body.paymentId) }),
      (p) => Boolean(p?.posRegisteredAt),
    );
    const events = await db
      .select()
      .from(s.pspWebhookEvents)
      .where(eq(s.pspWebhookEvents.pspEventId, `evt_dup_${suffix}`));
    const txs = await db
      .select()
      .from(s.transactions)
      .where(eq(s.transactions.paymentId, session.body.paymentId));
    const posPayments = await db
      .select()
      .from(s.fakePosPayments)
      .where(eq(s.fakePosPayments.reference, session.body.paymentId));
    expect({ events: events.length, txs: txs.length, posPayments: posPayments.length }).toEqual({
      events: 1,
      txs: 2,
      posPayments: 1,
    });
  });

  it('una tarjeta rechazada deja el pago en FAILED y la cuenta pendiente', async () => {
    const session = await createSession(qr.decline, 0);
    const sessionId = session.body.checkoutUrl.split('/').pop();
    await http().post(`/v1/fake-psp/sessions/${sessionId}/complete`).send({ outcome: 'decline' });
    const failed = await until(
      () => receipt(session.body.paymentId, session.body.statusToken).then((r) => r.body),
      (b) => b.status === 'FAILED',
    );
    expect(failed.failureReason).toBe('card_declined');
    expect((await http().get(`/v1/qr/${qr.decline}/bill`)).body.bill.pendingCents).toBe(850);
  });

  it('rechaza webhooks con firma inválida y recibos con token incorrecto', async () => {
    const res = await http()
      .post('/v1/webhooks/psp/fake')
      .set('content-type', 'application/json')
      .set(FAKE_PSP_SIGNATURE_HEADER, 't=1,v1=00')
      .send('{"id":"x"}');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');

    const session = await createSession(qr.decline, 0, `k-token-${suffix}`);
    expect((await receipt(session.body.paymentId, 'x'.repeat(32))).status).toBe(404);
  });

  it('si la caja está caída, la web QR pide avisar al personal', async () => {
    await db
      .update(s.fakePosLocations)
      .set({ healthy: false })
      .where(and(eq(s.fakePosLocations.locationId, locationId)));
    const res = await http().get(`/v1/qr/${qr.decline}/bill`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('POS_UNAVAILABLE');
    await db
      .update(s.fakePosLocations)
      .set({ healthy: true })
      .where(eq(s.fakePosLocations.locationId, locationId));
  });
});
