import { auditSchema } from './pg-schema.js';
import { index, jsonb, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '../../db/schema/columns.js';

/** Registro de auditoría de solo-inserción. */
export const auditLogs = auditSchema.table(
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
    /** Comercio al que pertenece la entrada (para su registro de actividad). Sin FK: es histórico. */
    merchantId: uuid('merchant_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_merchant_idx').on(t.merchantId, t.id),
  ],
);
