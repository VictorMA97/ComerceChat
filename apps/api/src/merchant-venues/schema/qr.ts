import { venuesSchema } from './pg-schema.js';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { char, index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { merchantLocations, tables } from './merchants.js';
import { createdAt, id } from '@comercechat/service-kit/db';
import { qrCodeStatus, qrCodeType } from './enums.js';

/** QR estáticos de mesa (FR-QR-01). Los de cobro desde la caja están en payments.payment_qr_codes. */
export const qrCodes = venuesSchema.table(
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
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: qrCodeStatus('status').notNull().default('ACTIVE'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by'),
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
