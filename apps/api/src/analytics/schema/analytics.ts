import { analyticsSchema } from './pg-schema.js';
import { bigint, index, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Modelo de lectura de la analítica del comercio (FR-ANA-01), alimentado por `PaymentCaptured.v1` y
 * `PaymentUserAssigned.v1` (ADR-029). Una fila por pago capturado; los importes son los del pago.
 */
export const paymentFacts = analyticsSchema.table(
  'payment_facts',
  {
    paymentId: uuid('payment_id').primaryKey(),
    merchantId: uuid('merchant_id').notNull(),
    userId: uuid('user_id'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull(),
    tipCents: bigint('tip_cents', { mode: 'number' }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('payment_facts_merchant_captured_idx').on(t.merchantId, t.capturedAt)],
);
