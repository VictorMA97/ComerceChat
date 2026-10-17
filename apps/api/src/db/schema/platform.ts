import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns.js';

/** Registro de auditoría de solo-inserción. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entity, t.entityId)],
);

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
