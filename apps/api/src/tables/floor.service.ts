import { Inject, Injectable } from '@nestjs/common';
import type { FloorTableStatus, FloorView } from '@comercechat/shared-types';
import { and, asc, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { merchantLocations, orders, payments, tables } from '../db/schema/index.js';
import { POS_CONNECTOR, type PosConnector, PosUnavailableError } from '../pos/pos-connector.js';
import { TableBillService } from './table-bill.service.js';

/** Una mesa se muestra como «Pagada» durante este tiempo tras cerrarse su cuenta. */
const RECENTLY_PAID_MS = 30 * 60 * 1000;
/** Inicio del día de hoy en Madrid, para las propinas del turno. */
const startOfDayMadrid = sql`(date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid')`;

/** Vista de sala del camarero (FR-MER-08): estado de cada mesa y propinas del día. */
@Injectable()
export class FloorService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(POS_CONNECTOR) private readonly pos: PosConnector,
    private readonly bills: TableBillService,
  ) {}

  async floor(merchantId: string): Promise<FloorView[]> {
    const locations = await this.db
      .select()
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, merchantId))
      .orderBy(asc(merchantLocations.name));
    return Promise.all(locations.map((l) => this.location(l.id, l.name)));
  }

  private async location(locationId: string, locationName: string): Promise<FloorView> {
    const [tableRows, todays] = await Promise.all([
      this.db.select().from(tables).where(eq(tables.locationId, locationId)),
      this.db
        .select({
          tableId: payments.tableId,
          tips: sql<number>`coalesce(sum(${payments.tipCents}), 0)::bigint`,
          amount: sql<number>`coalesce(sum(${payments.amountCents}), 0)::bigint`,
          last: sql<Date | null>`max(${payments.capturedAt})`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.locationId, locationId),
            eq(payments.status, 'CAPTURED'),
            isNotNull(payments.capturedAt),
            sql`${payments.capturedAt} >= ${startOfDayMadrid}`,
          ),
        )
        .groupBy(payments.tableId),
    ]);
    const byTable = new Map(todays.map((t) => [t.tableId, t]));

    const views = await Promise.all(
      tableRows
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))
        .map(async (t) => {
          const today = byTable.get(t.id);
          const base = {
            tableId: t.id,
            label: t.label,
            totalCents: 0,
            paidCents: 0,
            pendingCents: 0,
            reservedCents: 0,
            tipsTodayCents: Number(today?.tips ?? 0),
            lastPaymentAt: today?.last ? new Date(today.last).toISOString() : null,
          };
          if (!t.externalTableId) return { ...base, status: 'FREE' as FloorTableStatus };
          let bill;
          try {
            bill = await this.pos.getOpenBill(locationId, t.externalTableId);
          } catch (err) {
            if (!(err instanceof PosUnavailableError)) throw err;
            return { ...base, status: 'POS_DOWN' as FloorTableStatus };
          }
          if (!bill) {
            const [paid] = await this.db
              .select({ id: orders.id })
              .from(orders)
              .where(
                and(
                  eq(orders.tableId, t.id),
                  eq(orders.status, 'PAID'),
                  gt(orders.updatedAt, new Date(Date.now() - RECENTLY_PAID_MS)),
                ),
              )
              .orderBy(desc(orders.updatedAt))
              .limit(1);
            return { ...base, status: (paid ? 'PAID' : 'FREE') as FloorTableStatus };
          }
          const [order] = await this.db
            .select({ id: orders.id })
            .from(orders)
            .where(
              and(eq(orders.locationId, locationId), eq(orders.posExternalId, bill.externalBillId)),
            );
          const s = await this.bills.computeState(this.db, bill, order?.id ?? null);
          const paidCents = bill.totalCents - s.pendingCents;
          const status: FloorTableStatus =
            s.reservedCents > 0 ? 'PAYING' : paidCents > 0 ? 'PARTIAL' : 'OPEN';
          return {
            ...base,
            status,
            totalCents: bill.totalCents,
            paidCents,
            pendingCents: s.pendingCents,
            reservedCents: s.reservedCents,
          };
        }),
    );
    return {
      locationId,
      locationName,
      tipsTodayCents: todays.reduce((s, t) => s + Number(t.tips), 0),
      paymentsTodayCents: todays.reduce((s, t) => s + Number(t.amount), 0),
      tables: views,
    };
  }
}
