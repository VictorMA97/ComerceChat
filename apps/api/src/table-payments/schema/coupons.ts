import { relations, sql } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from '../../db/schema/columns.js';
import { users } from '../../identity/schema/users.js';
import { loyaltyRewards, promotions } from '../../loyalty/schema/loyalty.js';
import { merchants } from '../../merchant-venues/schema/merchants.js';
import { payments } from './payments.js';

/** Cupón de un solo uso vinculado a un usuario (FR-CPN-04). Lo financia el comercio (REG-04). */
export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    userId: uuid('user_id').references(() => users.id),
    promotionId: uuid('promotion_id').references(() => promotions.id),
    rewardId: uuid('reward_id').references(() => loyaltyRewards.id),
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
  (t) => [
    index('coupons_user_merchant_idx').on(t.userId, t.merchantId, t.status),
    // Una promoción emite como mucho un cupón por usuario.
    uniqueIndex('coupons_promotion_user_uq')
      .on(t.promotionId, t.userId)
      .where(sql`${t.promotionId} is not null`),
  ],
);

/** Canje de un cupón. La unicidad de coupon_id impide canjearlo dos veces (FR-CPN-06). */
export const couponRedemptions = pgTable('coupon_redemptions', {
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

export const couponsRelations = relations(coupons, ({ one }) => ({
  merchant: one(merchants, { fields: [coupons.merchantId], references: [merchants.id] }),
}));
