import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns.js';
import { qrCodeStatus, qrCodeType } from './enums.js';
import { merchantLocations, merchantUsers, tables } from './merchants.js';

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: id(),
    type: qrCodeType('type').notNull(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => merchantLocations.id),
    tableId: uuid('table_id').references(() => tables.id),
    shortCode: text('short_code').notNull().unique(),
    // HMAC-SHA256(secret, id‖location‖table‖version): detecta manipulación de la BD (ARCHITECTURE §8).
    signature: text('signature').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    nonce: text('nonce'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: qrCodeStatus('status').notNull().default('ACTIVE'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => merchantUsers.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('qr_codes_table_idx').on(t.tableId),
    index('qr_codes_location_idx').on(t.locationId),
    // Una mesa tiene como máximo un QR estático activo (FR-QR-05: al regenerar se revoca el anterior).
    uniqueIndex('qr_codes_one_active_per_table_uq')
      .on(t.tableId)
      .where(sql`${t.status} = 'ACTIVE' and ${t.type} = 'STATIC_TABLE'`),
  ],
);

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  location: one(merchantLocations, {
    fields: [qrCodes.locationId],
    references: [merchantLocations.id],
  }),
  table: one(tables, { fields: [qrCodes.tableId], references: [tables.id] }),
}));
