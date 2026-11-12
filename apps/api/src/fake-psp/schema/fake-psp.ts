import { fakePspSchema } from './pg-schema.js';
import { bigint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from '../../db/schema/columns.js';

/** Sesiones de pago del PSP simulado. */
export const fakePspSessions = fakePspSchema.table('fake_psp_sessions', {
  id: text('id').primaryKey(),
  paymentId: uuid('payment_id').notNull(),
  merchantName: text('merchant_name').notNull(),
  statementDescriptor: text('statement_descriptor').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  platformFeeCents: bigint('platform_fee_cents', { mode: 'number' }).notNull(),
  status: text('status')
    .$type<'OPEN' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'>()
    .notNull()
    .default('OPEN'),
  returnUrl: text('return_url').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});
