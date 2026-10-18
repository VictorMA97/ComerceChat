import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns.js';
import { orderSource, orderStatus } from './enums.js';
import { merchantLocations, tables } from './merchants.js';
import { users } from './users.js';

/**
 * Pedido o cuenta. Con software de caja, es un espejo de la cuenta abierta en el TPV
 * (source=POS, pos_external_id = id de la cuenta en el TPV). Los totales son la última foto leída.
 */
export const orders = pgTable(
  'orders',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => merchantLocations.id),
    tableId: uuid('table_id').references(() => tables.id),
    userId: uuid('user_id').references(() => users.id),
    source: orderSource('source').notNull(),
    status: orderStatus('status').notNull().default('OPEN'),
    subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull().default(0),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
    posExternalId: text('pos_external_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_location_pos_external_uq')
      .on(t.locationId, t.posExternalId)
      .where(sql`${t.posExternalId} is not null`),
    index('orders_table_idx').on(t.tableId),
  ],
);

export const orderItems = pgTable('order_items', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id'),
  /** Id estable de la línea en el TPV: las asignaciones por platos lo referencian. */
  posLineId: text('pos_line_id'),
  nameSnapshot: text('name_snapshot').notNull(),
  qty: integer('qty').notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
  modifiers: jsonb('modifiers').notNull().default([]),
});

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  location: one(merchantLocations, {
    fields: [orders.locationId],
    references: [merchantLocations.id],
  }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
