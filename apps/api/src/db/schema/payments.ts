import { relations } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns.js';
import { allocationStatus, paymentMethod, paymentStatus, transactionType } from './enums.js';
import { merchantLocations, merchants, tables } from './merchants.js';
import { orders } from './orders.js';
import { qrCodes } from './qr.js';
import { users } from './users.js';

/** Pago. Refleja el estado del PSP, que es la fuente de verdad del dinero (ARCHITECTURE §10). */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id').references(() => orders.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => merchantLocations.id),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    tableId: uuid('table_id').references(() => tables.id),
    /** QR de cobro generado desde la caja que originó el pago (FR-QR-03). */
    qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
    userId: uuid('user_id').references(() => users.id),
    psp: text('psp').notNull(),
    pspPaymentId: text('psp_payment_id').unique(),
    method: paymentMethod('method'),
    cardLast4: text('card_last4'),
    /** Importe sin propina (sobre el que se cobra la comisión de plataforma y se calculan puntos). */
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    tipCents: bigint('tip_cents', { mode: 'number' }).notNull().default(0),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    platformFeeCents: bigint('platform_fee_cents', { mode: 'number' }).notNull(),
    pspFeeCents: bigint('psp_fee_cents', { mode: 'number' }),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    status: paymentStatus('status').notNull().default('CREATED'),
    failureReason: text('failure_reason'),
    statementDescriptor: text('statement_descriptor').notNull(),
    /** FULL | EQUAL | ITEMS | AMOUNT | POS_QR (FR-PAY-02, FR-QR-03). */
    splitMode: text('split_mode').notNull().default('FULL'),
    guestSessionId: text('guest_session_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    /** Momento en que el pago quedó registrado en el software de caja (FR-POS-04). */
    posRegisteredAt: timestamp('pos_registered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('payments_order_idx').on(t.orderId),
    index('payments_qr_code_idx').on(t.qrCodeId),
    index('payments_status_expires_idx').on(t.status, t.expiresAt),
  ],
);

/**
 * Parte de una cuenta que cubre un pago (ARCHITECTURE §7). Un importe (kind=AMOUNT) o unidades de
 * una línea del TPV (kind=ITEM). Invariante: lo cobrado + lo reservado nunca supera el total; se
 * garantiza creando las asignaciones con el pedido bloqueado (FOR UPDATE).
 */
export const orderAllocations = pgTable(
  'order_allocations',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    kind: text('kind').$type<'AMOUNT' | 'ITEM'>().notNull(),
    posLineId: text('pos_line_id'),
    units: bigint('units', { mode: 'number' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    status: allocationStatus('status').notNull().default('RESERVED'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('order_allocations_order_status_idx').on(t.orderId, t.status),
    index('order_allocations_payment_idx').on(t.paymentId),
  ],
);

/** Espejo contable de los movimientos del PSP. Solo inserción. */
export const transactions = pgTable('transactions', {
  id: id(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id),
  type: transactionType('type').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  pspReference: text('psp_reference').notNull().unique(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Webhooks del PSP recibidos. La unicidad de (psp, psp_event_id) los deduplica (ADR-015). */
export const pspWebhookEvents = pgTable(
  'psp_webhook_events',
  {
    id: id(),
    psp: text('psp').notNull(),
    pspEventId: text('psp_event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: createdAt(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [uniqueIndex('psp_webhook_events_psp_event_uq').on(t.psp, t.pspEventId)],
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

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  location: one(merchantLocations, {
    fields: [payments.locationId],
    references: [merchantLocations.id],
  }),
  merchant: one(merchants, { fields: [payments.merchantId], references: [merchants.id] }),
  table: one(tables, { fields: [payments.tableId], references: [tables.id] }),
  transactions: many(transactions),
  allocations: many(orderAllocations),
  qrCode: one(qrCodes, { fields: [payments.qrCodeId], references: [qrCodes.id] }),
}));

export const orderAllocationsRelations = relations(orderAllocations, ({ one }) => ({
  payment: one(payments, { fields: [orderAllocations.paymentId], references: [payments.id] }),
  order: one(orders, { fields: [orderAllocations.orderId], references: [orders.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  payment: one(payments, { fields: [transactions.paymentId], references: [payments.id] }),
}));
