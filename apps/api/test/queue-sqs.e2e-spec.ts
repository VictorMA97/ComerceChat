// Colas en SQS (ADR-026) contra ElasticMQ (servicio `sqs` de docker compose): reintentos, DLQ y un
// cobro completo pasando por las tres colas de trabajo (webhook simulado, eventos del PSP, outbox).
import 'reflect-metadata';
import * as pos from '@comercechat/fake-pos/schema';
import { configureApi } from '../src/configure-api.js';
import { GetQueueUrlCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { QueueName, SqsTransport } from '@comercechat/service-kit';
import { loadEnv } from '../src/config/env.js';
import { DB, type Database } from '../src/db/client.js';
import * as s from '../src/db/schema/index.js';
import { apiPort, fakePsp, startSimulators } from './simulators.js';
import { QrService } from '../src/merchant-venues/qr/qr.service.js';

// Cada fichero de test corre en su propio proceso: el entorno se lee al crear la app.
process.env.QUEUE_DRIVER = 'sqs';
process.env.SQS_ENDPOINT ??= 'http://localhost:9324';
process.env.SQS_CREATE_QUEUES = 'on';
process.env.SQS_WAIT_SECONDS = '1';

const suffix = Date.now().toString(36);

const until = async <T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 20_000) => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
};

describe('Transporte SQS', () => {
  const env = loadEnv();
  const transport = new SqsTransport({
    region: env.AWS_REGION,
    endpoint: env.SQS_ENDPOINT,
    // Prefijo propio: la app del otro bloque consume las colas con el prefijo normal.
    prefix: `${env.QUEUE_PREFIX}-transporte`,
    createQueues: true,
    waitSeconds: 1,
  });
  const attempts: Record<string, number[]> = {};

  beforeAll(() => {
    // Los fallos son provocados: sin ruido en la salida del test.
    Logger.overrideLogger(false);
    transport.startWorker({
      name: QueueName.PSP_EVENTS,
      concurrency: 4,
      processor: async (job) => {
        const { key, failTimes } = job.data as { key: string; failTimes: number };
        (attempts[key] ??= []).push(job.attemptsMade);
        if (job.attemptsMade < failTimes) throw new Error(`fallo provocado ${job.attemptsMade}`);
      },
    });
  });

  afterAll(async () => {
    await transport.close();
  });

  it('reintenta con espera creciente hasta que el trabajo sale bien', async () => {
    await transport.add(QueueName.PSP_EVENTS, {
      name: 'prueba',
      data: { key: 'reintenta', failTimes: 2 },
      opts: { attempts: 5, backoffMs: 500 },
    });
    await until(
      async () => attempts.reintenta ?? [],
      (a) => a.length === 3,
    );
    expect(attempts.reintenta).toEqual([0, 1, 2]);
  });

  it('al agotar los intentos el mensaje acaba en la DLQ', async () => {
    await transport.addBulk(QueueName.PSP_EVENTS, [
      {
        name: 'prueba',
        data: { key: 'agota', failTimes: 99 },
        opts: { attempts: 2, backoffMs: 500 },
      },
    ]);
    await until(
      async () => attempts.agota ?? [],
      (a) => a.length === 2,
    );
    const client = new SQSClient({
      region: env.AWS_REGION,
      endpoint: env.SQS_ENDPOINT,
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    const { QueueUrl } = await client.send(
      new GetQueueUrlCommand({ QueueName: transport.queueName(QueueName.PSP_EVENTS, true) }),
    );
    const dlq = await until(
      () =>
        client
          .send(
            new ReceiveMessageCommand({
              QueueUrl,
              WaitTimeSeconds: 1,
              MessageAttributeNames: ['All'],
            }),
          )
          .then((r) => r.Messages ?? []),
      (m) => m.length > 0,
    );
    expect(JSON.parse(dlq[0]!.Body!).data).toEqual({ key: 'agota', failTimes: 99 });
    expect(dlq[0]!.MessageAttributes?.failureReason?.StringValue).toContain('fallo provocado');
    // Ni un intento más después de moverlo.
    await new Promise((r) => setTimeout(r, 2_500));
    expect(attempts.agota).toHaveLength(2);
    client.destroy();
  });
});

describe('Cobro completo con QUEUE_DRIVER=sqs', () => {
  let app: INestApplication;
  let db: Database;
  let code: string;
  const http = () => request(app.getHttpServer());
  let simulators: { close: () => Promise<void> } | undefined;

  beforeAll(async () => {
    simulators = await startSimulators();
    const env = loadEnv();
    expect(env.QUEUE_DRIVER).toBe('sqs');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApi(app, env);
    await app.listen(apiPort());
    db = app.get<Database>(DB);

    const [m] = await db
      .insert(s.merchants)
      .values({
        legalName: 'SQS S.L.',
        taxId: 'B55555555',
        brandName: `SQS ${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    const [loc] = await db
      .insert(s.merchantLocations)
      .values({
        merchantId: m!.id,
        name: 'Local SQS',
        address: 'Calle Cola 1, Madrid',
        geo: { lng: -3.7, lat: 40.4 },
        category: 'restaurant',
      })
      .returning();
    await db.insert(pos.fakePosLocations).values({ locationId: loc!.id, healthy: true });
    code = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(s.tables)
        .values({ locationId: loc!.id, label: 'Q1', externalTableId: 'Q1' })
        .returning();
      const [bill] = await tx
        .insert(pos.fakePosBills)
        .values({ locationId: loc!.id, externalTableId: 'Q1' })
        .returning();
      await tx
        .insert(pos.fakePosBillItems)
        .values({ billId: bill!.id, name: 'Caña', qty: 2, unitPriceCents: 250 });
      return (await app.get(QrService).issueTableQr(tx, { locationId: loc!.id, tableId: t!.id }))
        .shortCode;
    });
  });

  afterAll(async () => {
    await simulators?.close();
    await app?.close();
  });

  it('el pago se captura por webhook y se registra en la caja pasando por SQS', async () => {
    const session = await http()
      .post('/v1/payment-sessions')
      .set('Idempotency-Key', `sqs-${suffix}`)
      .send({
        qrCode: code,
        tip: { kind: 'amount', cents: 0 },
        guestSessionId: `sqs-${suffix}-0000`,
      });
    expect(session.status).toBe(201);
    const sessionId = session.body.checkoutUrl.split('/').pop();
    const done = await fakePsp()
      .post(`/v1/fake-psp/sessions/${sessionId}/complete`)
      .send({ outcome: 'succeed' });
    expect(done.status).toBe(200);

    const payment = await until(
      () => db.query.payments.findFirst({ where: eq(s.payments.id, session.body.paymentId) }),
      (p) => Boolean(p?.posRegisteredAt),
    );
    expect(payment!.status).toBe('CAPTURED');
    const posPayments = await db
      .select()
      .from(pos.fakePosPayments)
      .where(eq(pos.fakePosPayments.reference, session.body.paymentId));
    expect(posPayments).toHaveLength(1);
  });
});
