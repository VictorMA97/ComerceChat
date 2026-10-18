// P4: registro tras el pago, puntos, recompensas, cupones y analítica (ROADMAP §2, P4;
// SPEC §3.3 criterios 3 y 4).
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/passwords.js';
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
import { OTP_SENDER } from '../src/users/otp-sender.js';

const suffix = Date.now().toString(36);
const rnd = () => String(Math.floor(1_000_000 + Math.random() * 8_999_999));

const until = async <T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs = 20_000,
): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() - start > timeoutMs)
      throw new Error(`Timeout; último valor: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};

describe('P4: usuarios, puntos, cupones y analítica (E2E)', () => {
  let app: INestApplication;
  let db: Database;
  let locationId: string;
  let merchantToken: string;
  let userToken: string;
  const codes = new Map<string, string>();
  const phone = `+34699${rnd()}`;
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
      await tx
        .insert(s.fakePosBillItems)
        .values(
          items.map(([name, qty, unitPriceCents]) => ({
            billId: bill!.id,
            name,
            qty,
            unitPriceCents,
          })),
        );
      return { code, billId: bill!.id };
    });
  }

  const pay = (body: object, key: string, token?: string) => {
    const r = http().post('/v1/payment-sessions').set('Idempotency-Key', key);
    if (token) r.set('authorization', `Bearer ${token}`);
    return r.send(body);
  };
  const complete = (checkoutUrl: string) =>
    http()
      .post(`/v1/fake-psp/sessions/${checkoutUrl.split('/').pop()}/complete`)
      .send({ outcome: 'succeed' });
  const receipt = (id: string, t: string) =>
    http()
      .get(`/v1/payments/${id}?t=${t}`)
      .then((r) => r.body);
  const asUser = (path: string, method: 'get' | 'post' = 'get') =>
    http()[method](path).set('authorization', `Bearer ${userToken}`);

  beforeAll(async () => {
    const env = loadEnv();
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
        legalName: 'Puntos S.L.',
        taxId: 'B66666666',
        brandName: `Puntos ${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    const [loc] = await db
      .insert(s.merchantLocations)
      .values({
        merchantId: m!.id,
        name: 'Local puntos',
        address: 'Calle Puntos 1',
        geo: { lng: -3.7, lat: 40.4 },
        category: 'restaurant',
      })
      .returning();
    locationId = loc!.id;
    await db.insert(s.fakePosLocations).values({ locationId, healthy: true });
    const [program] = await db
      .insert(s.loyaltyPrograms)
      .values({ merchantId: m!.id, earnRule: { pointsPerEuro: 1 }, holdHours: 0 })
      .returning();
    await db
      .insert(s.loyaltyRewards)
      .values({
        programId: program!.id,
        name: 'Postre gratis',
        costPoints: 20,
        discountCents: 600,
      });
    await db.insert(s.merchantUsers).values({
      merchantId: m!.id,
      email: `puntos-${suffix}@e2e.test`,
      passwordHash: await hashPassword('secreto123'),
      role: 'OWNER',
    });
    merchantToken = (
      await http()
        .post('/v1/merchant/auth/login')
        .send({ email: `puntos-${suffix}@e2e.test`, password: 'secreto123' })
    ).body.accessToken;
    const promo = await http()
      .post('/v1/merchant/promotions')
      .set('authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Vuelve y te invitamos',
        discountCents: 500,
        minSpendCents: 2_000,
        validDays: 30,
      });
    expect(promo.status).toBe(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registro con código: exige aceptar las condiciones y bloquea tras 3 fallos', async () => {
    expect((await http().post('/v1/auth/otp/start').send({ phone })).status).toBe(200);
    const noTerms = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: codes.get(phone) });
    expect(noTerms.body.code).toBe('TERMS_REQUIRED');

    const other = `+34698${rnd()}`;
    await http().post('/v1/auth/otp/start').send({ phone: other });
    const tries = [];
    for (let i = 0; i < 3; i++) {
      tries.push(
        (
          await http()
            .post('/v1/auth/otp/verify')
            .send({ phone: other, code: '999999', consents: { terms: true, marketing: false } })
        ).body.code,
      );
    }
    expect(tries).toEqual(['OTP_INVALID', 'OTP_INVALID', 'OTP_BLOCKED']);

    const ok = await http()
      .post('/v1/auth/otp/verify')
      .send({
        phone,
        code: codes.get(phone),
        name: 'Lucía',
        consents: { terms: true, marketing: false },
      });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      isNew: true,
      user: { name: 'Lucía', consents: { terms: true, marketing: false } },
    });
    expect(ok.body.user.phoneMasked).toMatch(/^\+34 6•• ••• •\d\d$/);
    userToken = ok.body.accessToken;
  });

  it('un pago sin cuenta se puede reclamar después: puntos + cupón de bienvenida', async () => {
    const t = await tableWithBill('L1', [['Menú', 2, 1_500]]);
    const session = await pay(
      { qrCode: t.code, tip: { kind: 'amount', cents: 0 } },
      `l1-${suffix}`,
    );
    await complete(session.body.checkoutUrl);
    const r = await until(
      () => receipt(session.body.paymentId, session.body.statusToken),
      (b) => b.status === 'CAPTURED',
    );
    expect(r.points).toMatchObject({ points: 30, claimed: false, claimable: true });

    const claim = await asUser('/v1/me/claim', 'post').send({
      paymentId: session.body.paymentId,
      statusToken: session.body.statusToken,
    });
    expect(claim.body).toMatchObject({ pointsEarned: 30, balance: 30 });
    expect(claim.body.newCoupons).toMatchObject([
      { title: 'Vuelve y te invitamos', discountCents: 500, minSpendCents: 2_000 },
    ]);

    const again = await asUser('/v1/me/claim', 'post').send({
      paymentId: session.body.paymentId,
      statusToken: session.body.statusToken,
    });
    expect(again.body).toMatchObject({ pointsEarned: 0, balance: 30, newCoupons: [] });
    expect((await receipt(session.body.paymentId, session.body.statusToken)).points).toMatchObject({
      claimed: true,
      claimable: false,
    });
  });

  it('pago identificado con cupón: descuento, puntos automáticos y un solo apunte aunque el webhook llegue 10 veces (criterio 3)', async () => {
    const t = await tableWithBill('L2', [['Cena', 1, 2_500]]);
    const [coupon] = (await asUser('/v1/me/coupons').query({ merchantId: '' })).body as {
      id: string;
      title: string;
    }[];
    expect(coupon!.title).toBe('Vuelve y te invitamos');

    const session = await pay(
      { qrCode: t.code, tip: { kind: 'percent', value: 10 }, couponId: coupon!.id },
      `l2-${suffix}`,
      userToken,
    );
    // Cubre 25 €, el cupón paga 5 €, el comensal 20 € + 10 % de propina sobre lo que paga.
    expect(session.body).toMatchObject({ amountCents: 2_500, discountCents: 500, tipCents: 200 });

    const fakeSession = await db.query.fakePspSessions.findFirst({
      where: eq(s.fakePspSessions.paymentId, session.body.paymentId),
    });
    expect(fakeSession!.amountCents).toBe(2_200);
    const body = JSON.stringify({
      id: `evt_l2_${suffix}`,
      type: 'payment.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        session_id: fakeSession!.id,
        amount: 2_200,
        charge_id: `fch_l2_${suffix}`,
        method: 'CARD',
        card_last4: '4242',
        psp_fee: 46,
      },
    });
    const sig = signFakePspPayload(loadEnv().FAKE_PSP_WEBHOOK_SECRET, body);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        http()
          .post('/v1/webhooks/psp/fake')
          .set('content-type', 'application/json')
          .set(FAKE_PSP_SIGNATURE_HEADER, sig)
          .send(body),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);

    await until(
      () => db.select().from(s.fakePosBills).where(eq(s.fakePosBills.id, t.billId)),
      ([b]) => b?.status === 'CLOSED',
    );
    await until(
      () =>
        db
          .select()
          .from(s.pointsLedgerEntries)
          .where(eq(s.pointsLedgerEntries.paymentId, session.body.paymentId)),
      (rows) => rows.length > 0,
    );
    await new Promise((r) => setTimeout(r, 1_000));
    const entries = await db
      .select()
      .from(s.pointsLedgerEntries)
      .where(eq(s.pointsLedgerEntries.paymentId, session.body.paymentId));
    expect(entries).toMatchObject([{ type: 'EARN', points: 20 }]);
    const [posPayment] = await db
      .select()
      .from(s.fakePosPayments)
      .where(eq(s.fakePosPayments.billId, t.billId));
    expect(posPayment).toMatchObject({ amountCents: 2_500, discountCents: 500, tipCents: 200 });
    const r = await receipt(session.body.paymentId, session.body.statusToken);
    expect(r).toMatchObject({
      discountCents: 500,
      couponTitle: 'Vuelve y te invitamos',
      totalCents: 2_200,
    });

    const loyalty = (await asUser('/v1/me/loyalty')).body;
    expect(loyalty[0]).toMatchObject({ balance: 50 });
  });

  it('canjear puntos por una recompensa emite un cupón y descuenta el saldo', async () => {
    const reward = (await asUser('/v1/me/loyalty')).body[0].rewards[0];
    const coupon = await asUser(`/v1/me/rewards/${reward.id}/redeem`, 'post');
    expect(coupon.body).toMatchObject({
      title: 'Postre gratis',
      discountCents: 600,
      status: 'ACTIVE',
    });
    expect((await asUser('/v1/me/loyalty')).body[0].balance).toBe(30);
  });

  it('100 peticiones paralelas con el mismo cupón: exactamente un canje (criterio 4)', async () => {
    const t = await tableWithBill('L3', [['Banquete', 1, 100_000]]);
    const [coupon] = (await asUser('/v1/me/coupons')).body as { id: string; title: string }[];
    expect(coupon!.title).toBe('Postre gratis');

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        pay(
          {
            qrCode: t.code,
            split: { mode: 'AMOUNT', amountCents: 1_000 },
            tip: { kind: 'amount', cents: 0 },
            couponId: coupon!.id,
            guestSessionId: `guest-l3-${suffix}-${String(i).padStart(4, '0')}`,
          },
          `l3-${suffix}-${i}`,
          userToken,
        ),
      ),
    );
    const winners = results.filter((r) => r.status === 201);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.body.discountCents).toBe(600);
    expect(new Set(results.filter((r) => r.status !== 201).map((r) => r.body.code))).toEqual(
      new Set(['COUPON_UNAVAILABLE']),
    );

    await complete(winners[0]!.body.checkoutUrl);
    await until(
      () =>
        db.select().from(s.couponRedemptions).where(eq(s.couponRedemptions.couponId, coupon!.id)),
      (rows) => rows.length === 1,
    );
    const [c] = await db
      .select()
      .from(s.coupons)
      .where(and(eq(s.coupons.id, coupon!.id)));
    expect(c!.status).toBe('REDEEMED');
    expect((await asUser('/v1/me/coupons')).body).toHaveLength(0);
  }, 60_000);

  it('el comercio ve ventas, descuentos, propinas, clientes identificados y su promoción', async () => {
    const a = await http()
      .get('/v1/merchant/analytics?period=today')
      .set('authorization', `Bearer ${merchantToken}`);
    expect(a.body.current).toMatchObject({
      payments: 3,
      identifiedCustomers: 1,
      discountsCents: 1_100,
      tipsCents: 200,
    });
    expect(a.body.current.volumeCents).toBe(3_000 + 2_000 + 400);
    const promos = await http()
      .get('/v1/merchant/promotions')
      .set('authorization', `Bearer ${merchantToken}`);
    expect(promos.body[0]).toMatchObject({
      name: 'Vuelve y te invitamos',
      status: 'ACTIVE',
      issued: 1,
      redeemed: 1,
    });
  });
});
