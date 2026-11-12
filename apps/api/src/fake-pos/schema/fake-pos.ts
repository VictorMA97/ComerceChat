import { fakePosSchema } from './pg-schema.js';
// Tablas de los simuladores de la PoC (ARCHITECTURE §16.3). Hacen de "sistemas externos":
// el software de caja (fake_pos_*) y el PSP (fake_psp_*). No deben existir en producción (ADR-018).
import { boolean, bigint, index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from '@comercechat/service-kit/db';

export const fakePosMenuItems = fakePosSchema.table('fake_pos_menu_items', {
  id: id(),
  locationId: uuid('location_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
});

export const fakePosLocations = fakePosSchema.table('fake_pos_locations', {
  locationId: uuid('location_id').primaryKey(),
  /** Permite simular la caída del TPV desde el simulador (FR-POS-06). */
  healthy: boolean('healthy').notNull().default(true),
});

export const fakePosBills = fakePosSchema.table(
  'fake_pos_bills',
  {
    id: id(),
    locationId: uuid('location_id').notNull(),
    externalTableId: text('external_table_id').notNull(),
    status: text('status').$type<'OPEN' | 'CLOSED'>().notNull().default('OPEN'),
    openedAt: createdAt(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('fake_pos_bills_table_idx').on(t.locationId, t.externalTableId, t.status)],
);

export const fakePosBillItems = fakePosSchema.table('fake_pos_bill_items', {
  id: id(),
  billId: uuid('bill_id')
    .notNull()
    .references(() => fakePosBills.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  qty: bigint('qty', { mode: 'number' }).notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
  createdAt: createdAt(),
});

/** Pagos registrados en el TPV simulado. `reference` = id del pago de ComerceChat (idempotente). */
export const fakePosPayments = fakePosSchema.table(
  'fake_pos_payments',
  {
    id: id(),
    billId: uuid('bill_id')
      .notNull()
      .references(() => fakePosBills.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    tipCents: bigint('tip_cents', { mode: 'number' }).notNull(),
    /** Parte cubierta con un cupón del comercio (descuento): no se cobra al comensal. */
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('fake_pos_payments_reference_uq').on(t.reference)],
);
