import { bigint, char, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '@comercechat/service-kit/db';
import { paymentQrStatus } from './enums.js';
import { paymentsSchema } from './pg-schema.js';

/**
 * QR de cobro de un solo uso que el personal genera desde la caja para una mesa (FR-QR-03, ADR-023).
 * Separado de los QR estáticos de merchant-venues: la captura del pago lo bloquea y lo consume en su
 * transacción (ADR-029). El token firmado (JWS) va en la URL; aquí quedan el importe, el nonce y el
 * estado, que se comprueban al pagar.
 */
export const paymentQrCodes = paymentsSchema.table(
  'payment_qr_codes',
  {
    id: id(),
    locationId: uuid('location_id').notNull(),
    tableId: uuid('table_id').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    nonce: text('nonce').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: paymentQrStatus('status').notNull().default('ACTIVE'),
    /** Usuario del comercio que lo generó (identity). Sin FK: es otro contexto. */
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('payment_qr_codes_table_idx').on(t.tableId, t.createdAt)],
);
