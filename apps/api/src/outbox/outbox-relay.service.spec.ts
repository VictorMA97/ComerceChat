import { describe, expect, it } from 'vitest';
import { domainEventsQueue, SUBSCRIPTIONS } from '../contracts/events.js';
import type { Database } from '../db/client.js';
import type { QueueService } from '../queue/queue.service.js';
import type { NewJob, QueueName } from '../queue/queue.types.js';
import { OutboxRelayService } from './outbox-relay.service.js';

/** Base de datos mínima: devuelve `pending` al leer el outbox y acepta el UPDATE de publicado. */
function fakeDb(pending: Record<string, unknown>[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    for: () => Promise.resolve(pending),
    set: () => chain,
  };
  const tx = { select: () => chain, update: () => ({ set: () => ({ where: async () => {} }) }) };
  return { transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as Database;
}

function fakeQueues() {
  const sent: { queue: QueueName; jobs: NewJob[] }[] = [];
  const workers: QueueName[] = [];
  const queues = {
    runsWorkers: true,
    addBulk: async (queue: QueueName, jobs: NewJob[]) => void sent.push({ queue, jobs }),
    registerWorker: (queue: QueueName) => void workers.push(queue),
  } as unknown as QueueService;
  return { queues, sent, workers };
}

describe('OutboxRelayService (ADR-029)', () => {
  it('rechaza suscripciones que no están en el catálogo de contratos', () => {
    const { queues } = fakeQueues();
    const relay = new OutboxRelayService(fakeDb([]), queues);
    expect(() => relay.on('analytics', 'CouponIssued.v1', async () => {})).toThrow(
      /no está suscrito/,
    );
  });

  it('registra un worker por contexto consumidor, no por evento', () => {
    const { queues, workers } = fakeQueues();
    const relay = new OutboxRelayService(fakeDb([]), queues);
    relay.on('analytics', 'PaymentCaptured.v1', async () => {});
    relay.on('analytics', 'PaymentUserAssigned.v1', async () => {});
    expect(workers).toEqual([domainEventsQueue('analytics')]);
  });

  it('publica una copia del evento en la cola de cada suscriptor', async () => {
    const { queues, sent } = fakeQueues();
    const event = {
      id: 'evt-1',
      type: 'PaymentCaptured.v1',
      aggregate: 'payment',
      aggregateId: 'pay-1',
      payload: { paymentId: 'pay-1' },
    };
    const relay = new OutboxRelayService(fakeDb([event]), queues);
    await expect(relay.relay()).resolves.toBe(1);
    expect(sent.map((s) => s.queue).sort()).toEqual(
      SUBSCRIPTIONS['PaymentCaptured.v1'].map(domainEventsQueue).sort(),
    );
    // El jobId incluye el consumidor: en BullMQ, republicar no duplica el trabajo de cada uno.
    expect(sent.flatMap((s) => s.jobs.map((j) => j.opts?.jobId)).sort()).toEqual(
      SUBSCRIPTIONS['PaymentCaptured.v1'].map((c) => `evt-1-${c}`).sort(),
    );
  });
});
