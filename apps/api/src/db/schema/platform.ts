import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns.js';

/**
 * Tablas de infraestructura compartida (outbox e Idempotency-Key). En la PoC son comunes a todos los
 * contextos; al separar los servicios, cada uno tendrá las suyas en su esquema (MIGRACION §3.4).
 */
export const platformSchema = pgSchema('platform');

/** Patrón outbox: los eventos de dominio se escriben en la misma transacción (ARCHITECTURE §5). */
export const outboxEvents = platformSchema.table(
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
export const idempotencyKeys = platformSchema.table(
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
