import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { QrResolution, TableBill } from '@comercechat/shared-types';
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Database, type Tx } from '../db/client.js';
import {
  merchantLocations,
  merchants,
  orderAllocations,
  orderItems,
  orders,
  payments,
  tables,
} from '../db/schema/index.js';
import {
  type PosBill,
  POS_CONNECTOR,
  type PosConnector,
  PosUnavailableError,
} from '../pos/pos-connector.js';
import { CouponsService } from '../loyalty/coupons.service.js';
import { QrService } from '../qr/qr.service.js';

export interface TableContext {
  qr: QrResolution;
  merchantId: string;
  locationId: string;
  tableId: string;
  externalTableId: string;
  tipConfig: { enabled: boolean; percentages: number[] };
}

export interface LineUsage {
  paidUnits: number;
  reservedUnits: number;
}

export interface BillState {
  posBill: PosBill;
  orderId: string | null;
  /** Cobrado por ComerceChat pero aún no registrado en el TPV. */
  inFlightCents: number;
  /** Total − pagado en el TPV − cobrado sin registrar. */
  pendingCents: number;
  /** En sesiones de pago abiertas (asignaciones RESERVED vigentes). */
  reservedCents: number;
  /** Lo que se puede pagar ahora mismo. */
  availableCents: number;
  lineUsage: Map<string, LineUsage>;
}

type Reader = Pick<Database, 'select'>;

@Injectable()
export class TableBillService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(POS_CONNECTOR) private readonly pos: PosConnector,
    private readonly qr: QrService,
  ) {}

  /** Resuelve el QR de mesa y los datos internos necesarios para leer y cobrar su cuenta. */
  async context(code: string): Promise<TableContext> {
    const qr = await this.qr.resolve(code);
    if (!qr.table) {
      throw new AppError('QR_NOT_TABLE', HttpStatus.CONFLICT, 'Este QR no corresponde a una mesa');
    }
    const [row] = await this.db
      .select({
        merchantId: merchantLocations.merchantId,
        tipConfig: merchantLocations.tipConfig,
        externalTableId: tables.externalTableId,
      })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .where(eq(tables.id, qr.table.id));
    if (!row?.externalTableId) {
      throw new AppError(
        'TABLE_NOT_LINKED',
        HttpStatus.CONFLICT,
        'Esta mesa todavía no está conectada con la caja. Pide la cuenta al personal.',
      );
    }
    return {
      qr,
      merchantId: row.merchantId,
      locationId: qr.location.id,
      tableId: qr.table.id,
      externalTableId: row.externalTableId,
      tipConfig: row.tipConfig,
    };
  }

  /** Contexto de una mesa por su id (QR de cobro de la caja, simulador). */
  async contextForTable(tableId: string): Promise<TableContext> {
    const [row] = await this.db
      .select({ table: tables, location: merchantLocations, merchant: merchants })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .innerJoin(merchants, eq(merchants.id, merchantLocations.merchantId))
      .where(eq(tables.id, tableId));
    if (!row) throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');
    if (!row.table.externalTableId) {
      throw new AppError(
        'TABLE_NOT_LINKED',
        HttpStatus.CONFLICT,
        'La mesa no está enlazada con la caja',
      );
    }
    return {
      qr: {
        shortCode: '',
        type: 'DYNAMIC_AMOUNT',
        merchant: {
          id: row.merchant.id,
          brandName: row.merchant.brandName,
          logoUrl: row.merchant.logoUrl,
        },
        location: { id: row.location.id, name: row.location.name, address: row.location.address },
        table: { id: row.table.id, label: row.table.label },
      },
      merchantId: row.merchant.id,
      locationId: row.location.id,
      tableId: row.table.id,
      externalTableId: row.table.externalTableId,
      tipConfig: row.location.tipConfig,
    };
  }

  /** Lee la cuenta del TPV. `null` si la mesa no tiene cuenta abierta. */
  async readPosBill(
    ctx: Pick<TableContext, 'locationId' | 'externalTableId'>,
  ): Promise<PosBill | null> {
    try {
      return await this.pos.getOpenBill(ctx.locationId, ctx.externalTableId);
    } catch (err) {
      if (err instanceof PosUnavailableError) {
        throw new AppError(
          'POS_UNAVAILABLE',
          HttpStatus.SERVICE_UNAVAILABLE,
          'No podemos consultar la cuenta ahora mismo. Pide la cuenta al personal.',
        );
      }
      throw err;
    }
  }

  async state(ctx: TableContext): Promise<BillState | null> {
    const posBill = await this.readPosBill(ctx);
    if (!posBill) return null;
    const [order] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.locationId, ctx.locationId),
          eq(orders.posExternalId, posBill.externalBillId),
        ),
      );
    return this.computeState(this.db, posBill, order?.id ?? null);
  }

  /**
   * Calcula lo pendiente, lo reservado y el uso de cada línea. Dentro de `createSession` se llama
   * con la transacción que tiene el pedido bloqueado, para que el cálculo sea consistente.
   */
  async computeState(db: Reader, posBill: PosBill, orderId: string | null): Promise<BillState> {
    let inFlightCents = 0;
    let reservedCents = 0;
    const lineUsage = new Map<string, LineUsage>();

    if (orderId) {
      const [inFlight] = await db
        .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::bigint` })
        .from(payments)
        .where(
          and(
            eq(payments.orderId, orderId),
            eq(payments.status, 'CAPTURED'),
            isNull(payments.posRegisteredAt),
          ),
        );
      inFlightCents = Number(inFlight?.cents ?? 0);

      const allocations = await db
        .select()
        .from(orderAllocations)
        .where(
          and(
            eq(orderAllocations.orderId, orderId),
            or(
              eq(orderAllocations.status, 'PAID'),
              and(
                eq(orderAllocations.status, 'RESERVED'),
                gt(orderAllocations.expiresAt, new Date()),
              ),
            ),
          ),
        );
      for (const a of allocations) {
        if (a.status === 'RESERVED') reservedCents += a.amountCents;
        if (a.kind === 'ITEM' && a.posLineId) {
          const u = lineUsage.get(a.posLineId) ?? { paidUnits: 0, reservedUnits: 0 };
          if (a.status === 'PAID') u.paidUnits += a.units ?? 0;
          else u.reservedUnits += a.units ?? 0;
          lineUsage.set(a.posLineId, u);
        }
      }
    }

    const pendingCents = Math.max(0, posBill.totalCents - posBill.paidCents - inFlightCents);
    return {
      posBill,
      orderId,
      inFlightCents,
      pendingCents,
      reservedCents,
      availableCents: Math.max(0, pendingCents - reservedCents),
      lineUsage,
    };
  }

  async view(code: string): Promise<TableBill> {
    const ctx = await this.context(code);
    const state = await this.state(ctx);
    return {
      qr: ctx.qr,
      bill: state
        ? {
            lines: state.posBill.lines.map((l) => {
              const usage = state.lineUsage.get(l.externalLineId);
              return {
                lineId: l.externalLineId,
                name: l.name,
                qty: l.qty,
                unitPriceCents: l.unitPriceCents,
                totalCents: l.qty * l.unitPriceCents,
                paidUnits: usage?.paidUnits ?? 0,
                reservedUnits: usage?.reservedUnits ?? 0,
              };
            }),
            totalCents: state.posBill.totalCents,
            paidCents: state.posBill.totalCents - state.pendingCents,
            pendingCents: state.pendingCents,
            reservedCents: state.reservedCents,
            availableCents: state.availableCents,
            currency: 'EUR',
          }
        : null,
      tips: ctx.tipConfig,
      guestMaxPaymentCents: this.env.GUEST_MAX_PAYMENT_CENTS,
    };
  }

  /**
   * Crea o actualiza el pedido espejo de la cuenta del TPV y bloquea su fila (FOR UPDATE) para
   * serializar los pagos concurrentes de la misma mesa. Debe llamarse dentro de una transacción.
   */
  async lockOrderMirror(tx: Tx, ctx: TableContext, bill: PosBill) {
    const [order] = await tx
      .insert(orders)
      .values({
        locationId: ctx.locationId,
        tableId: ctx.tableId,
        source: 'POS',
        posExternalId: bill.externalBillId,
        subtotalCents: bill.totalCents,
        totalCents: bill.totalCents,
      })
      .onConflictDoUpdate({
        target: [orders.locationId, orders.posExternalId],
        targetWhere: sql`${orders.posExternalId} is not null`,
        set: { subtotalCents: bill.totalCents, totalCents: bill.totalCents, updatedAt: new Date() },
      })
      .returning();
    await tx.execute(sql`select 1 from ${orders} where ${orders.id} = ${order!.id} for update`);
    await tx.delete(orderItems).where(eq(orderItems.orderId, order!.id));
    if (bill.lines.length) {
      await tx.insert(orderItems).values(
        bill.lines.map((l) => ({
          orderId: order!.id,
          posLineId: l.externalLineId,
          nameSnapshot: l.name,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
        })),
      );
    }
    return order!;
  }

  /**
   * Libera lo que tenían reservado unos pagos que no se completaron (fallidos, caducados, cancelados o
   * sustituidos): su parte de la cuenta y el cupón, si lo había.
   */
  static async releaseAllocations(tx: Tx, paymentIds: string[]): Promise<void> {
    if (paymentIds.length === 0) return;
    await CouponsService.release(tx, paymentIds);
    await tx
      .update(orderAllocations)
      .set({ status: 'RELEASED' })
      .where(
        and(
          inArray(orderAllocations.paymentId, paymentIds),
          eq(orderAllocations.status, 'RESERVED'),
        ),
      );
  }
}
