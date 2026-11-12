import { paymentsSchema } from './pg-schema.js';
import { bigint, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { payments } from './payments.js';
import { createdAt, id, updatedAt } from '../../db/schema/columns.js';

/**
 * Cupón de un solo uso vinculado a un usuario (FR-CPN-04). Lo financia el comercio (REG-04). Lo emite
 * loyalty (`coupon_issuances`) y llega por `CouponIssued.v1` con el mismo id; aquí vive su estado
 * para reservarlo y canjearlo en la transacción del pago (ADR-029).
 */
export const coupons = paymentsSchema.table(
  'coupons',
  {
    id: id(),
    merchantId: uuid('merchant_id').notNull(),
    userId: uuid('user_id'),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull(),
    minSpendCents: bigint('min_spend_cents', { mode: 'number' }).notNull().default(0),
    status: text('status')
      .$type<'ACTIVE' | 'RESERVED' | 'REDEEMED' | 'EXPIRED' | 'REVOKED'>()
      .notNull()
      .default('ACTIVE'),
    reservedPaymentId: uuid('reserved_payment_id').references(() => payments.id),
    reservedUntil: timestamp('reserved_until', { withTimezone: true }),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('coupons_user_merchant_idx').on(t.userId, t.merchantId, t.status)],
);

/** Canje de un cupón. La unicidad de coupon_id impide canjearlo dos veces (FR-CPN-06). */
export const couponRedemptions = paymentsSchema.table('coupon_redemptions', {
  id: id(),
  couponId: uuid('coupon_id')
    .notNull()
    .unique()
    .references(() => coupons.id),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id),
  discountCents: bigint('discount_cents', { mode: 'number' }).notNull(),
  redeemedAt: createdAt(),
});
