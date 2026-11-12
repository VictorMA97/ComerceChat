import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from '../../db/schema/columns.js';
import { users } from '../../identity/schema/users.js';
import { merchants } from '../../merchant-venues/schema/merchants.js';
import { payments } from '../../table-payments/schema/payments.js';

/** Programa de fidelización de un comercio (FR-LOY-01). En el MVP, uno por comercio (ADR-005). */
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: id(),
  merchantId: uuid('merchant_id')
    .notNull()
    .unique()
    .references(() => merchants.id),
  type: text('type').$type<'POINTS' | 'STAMPS'>().notNull().default('POINTS'),
  /** `{ pointsPerEuro }`: puntos por euro pagado sin propina. */
  earnRule: jsonb('earn_rule').$type<{ pointsPerEuro: number }>().notNull(),
  /** Horas que un movimiento EARN pasa en PENDING (0 en la PoC para la demo). */
  holdHours: integer('hold_hours').notNull().default(24),
  expiryDays: integer('expiry_days').notNull().default(365),
  status: text('status').$type<'ACTIVE' | 'PAUSED'>().notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Recompensa canjeable por puntos: al canjearla se emite un cupón de un solo uso (FR-LOY-03). */
export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: id(),
  programId: uuid('program_id')
    .notNull()
    .references(() => loyaltyPrograms.id),
  name: text('name').notNull(),
  costPoints: integer('cost_points').notNull(),
  /** Valor del cupón que genera, en céntimos. */
  discountCents: bigint('discount_cents', { mode: 'number' }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const loyaltyAccounts = pgTable(
  'loyalty_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    programId: uuid('program_id')
      .notNull()
      .references(() => loyaltyPrograms.id),
    /** Suma de los movimientos AVAILABLE; se actualiza en la misma transacción (ADR-012). */
    balanceCached: integer('balance_cached').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('loyalty_accounts_user_program_uq').on(t.userId, t.programId)],
);

/** Registro contable de puntos, de solo inserción salvo PENDING → AVAILABLE | VOID (ADR-012). */
export const pointsLedgerEntries = pgTable(
  'points_ledger_entries',
  {
    id: id(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => loyaltyAccounts.id),
    type: text('type').$type<'EARN' | 'REDEEM' | 'EXPIRE' | 'REVERSE' | 'ADJUST'>().notNull(),
    points: integer('points').notNull(),
    status: text('status').$type<'PENDING' | 'AVAILABLE' | 'VOID'>().notNull(),
    paymentId: uuid('payment_id').references(() => payments.id),
    couponId: uuid('coupon_id'),
    reason: text('reason'),
    createdBy: text('created_by'),
    availableAt: timestamp('available_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('points_ledger_account_idx').on(t.accountId, t.status),
    // Un pago genera puntos una sola vez, aunque el webhook o la reclamación lleguen repetidos.
    uniqueIndex('points_ledger_earn_payment_uq')
      .on(t.paymentId)
      .where(sql`${t.type} = 'EARN'`),
  ],
);

/** Promoción del comercio (FR-CPN-01). En la PoC solo la plantilla COMEBACK («Vuelve y te invitamos»). */
export const promotions = pgTable('promotions', {
  id: id(),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id),
  template: text('template').$type<'COMEBACK'>().notNull(),
  name: text('name').notNull(),
  /** `{ discountCents, minSpendCents, validDays }`. */
  rules: jsonb('rules')
    .$type<{ discountCents: number; minSpendCents: number; validDays: number }>()
    .notNull(),
  status: text('status').$type<'ACTIVE' | 'ENDED'>().notNull().default('ACTIVE'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ many }) => ({
  rewards: many(loyaltyRewards),
}));
export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
}));
export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyAccounts.programId],
    references: [loyaltyPrograms.id],
  }),
  entries: many(pointsLedgerEntries),
}));
export const pointsLedgerEntriesRelations = relations(pointsLedgerEntries, ({ one }) => ({
  account: one(loyaltyAccounts, {
    fields: [pointsLedgerEntries.accountId],
    references: [loyaltyAccounts.id],
  }),
}));
