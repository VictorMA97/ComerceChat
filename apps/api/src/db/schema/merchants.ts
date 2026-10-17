import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, geographyPoint, id, updatedAt } from './columns.js';
import { merchantStatus, merchantUserRole } from './enums.js';

export const merchants = pgTable('merchants', {
  id: id(),
  legalName: text('legal_name').notNull(),
  taxId: text('tax_id').notNull(),
  brandName: text('brand_name').notNull(),
  logoUrl: text('logo_url'),
  status: merchantStatus('status').notNull().default('ONBOARDING'),
  psp: text('psp'),
  pspAccountId: text('psp_account_id').unique(),
  pspKybStatus: text('psp_kyb_status'),
  planId: text('plan_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const merchantUsers = pgTable('merchant_users', {
  id: id(),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: merchantUserRole('role').notNull(),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface TipConfig {
  enabled: boolean;
  /** Porcentajes sugeridos (FR-PAY-03, FR-MER-06). */
  percentages: number[];
}

export const merchantLocations = pgTable(
  'merchant_locations',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    address: text('address').notNull(),
    geo: geographyPoint('geo').notNull(),
    timezone: text('timezone').notNull().default('Europe/Madrid'),
    openingHours: jsonb('opening_hours').$type<Record<string, string[]>>().notNull().default({}),
    category: text('category').notNull(),
    // FK a pos_integrations cuando exista la tabla (M2).
    posIntegrationId: uuid('pos_integration_id'),
    tipConfig: jsonb('tip_config')
      .$type<TipConfig>()
      .notNull()
      .default({ enabled: true, percentages: [0, 5, 10] }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('merchant_locations_merchant_idx').on(t.merchantId),
    index('merchant_locations_geo_idx').using('gist', t.geo),
  ],
);

export const tables = pgTable(
  'tables',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => merchantLocations.id),
    label: text('label').notNull(),
    capacity: integer('capacity').notNull().default(4),
    externalTableId: text('external_table_id'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('tables_location_label_uq').on(t.locationId, t.label)],
);

export const merchantsRelations = relations(merchants, ({ many }) => ({
  users: many(merchantUsers),
  locations: many(merchantLocations),
}));

export const merchantUsersRelations = relations(merchantUsers, ({ one }) => ({
  merchant: one(merchants, { fields: [merchantUsers.merchantId], references: [merchants.id] }),
}));

export const merchantLocationsRelations = relations(merchantLocations, ({ one, many }) => ({
  merchant: one(merchants, { fields: [merchantLocations.merchantId], references: [merchants.id] }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one }) => ({
  location: one(merchantLocations, {
    fields: [tables.locationId],
    references: [merchantLocations.id],
  }),
}));
