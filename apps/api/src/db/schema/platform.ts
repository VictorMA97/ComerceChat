import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns.js';

/** Patrón outbox: los eventos de dominio se escriben en la misma transacción (ARCHITECTURE §5). */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: id(),
    aggregate: text('aggregate').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    index('outbox_events_unpublished_idx')
      .on(t.createdAt)
      .where(sql`${t.publishedAt} is null`),
  ],
);

/** Respuestas guardadas por Idempotency-Key durante 24 h (ARCHITECTURE §11). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: id(),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    statusCode: bigint('status_code', { mode: 'number' }),
    response: jsonb('response'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('idempotency_keys_scope_key_uq').on(t.scope, t.key)],
);
