import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import {
  fakePosBillItems,
  fakePosBills,
  fakePosLocations,
  fakePosPayments,
} from '../db/schema/index.js';
import {
  type PosBill,
  type PosConnector,
  type PosPaymentInput,
  PosUnavailableError,
} from './pos-connector.js';

/**
 * Software de caja simulado sobre las tablas fake_pos_* (ARCHITECTURE §16.3).
 * Se maneja desde el simulador de caja del panel (/pos-simulator).
 */
@Injectable()
export class FakePosConnector implements PosConnector {
  constructor(@Inject(DB) private readonly db: Database) {}

  async health(locationId: string): Promise<'ok' | 'down'> {
    const row = await this.db.query.fakePosLocations.findFirst({
      where: eq(fakePosLocations.locationId, locationId),
    });
    return row?.healthy === false ? 'down' : 'ok';
  }

  async getOpenBill(locationId: string, externalTableId: string): Promise<PosBill | null> {
    await this.assertUp(locationId);
    const bill = await this.db.query.fakePosBills.findFirst({
      where: and(
        eq(fakePosBills.locationId, locationId),
        eq(fakePosBills.externalTableId, externalTableId),
        eq(fakePosBills.status, 'OPEN'),
      ),
    });
    if (!bill) return null;
    return this.toPosBill(bill.id);
  }

  async registerPayment(
    locationId: string,
    externalTableId: string,
    payment: PosPaymentInput,
  ): Promise<{ billClosed: boolean }> {
    await this.assertUp(locationId);
    return this.db.transaction(async (tx) => {
      const already = await tx.query.fakePosPayments.findFirst({
        where: eq(fakePosPayments.reference, payment.reference),
      });
      const bill = already
        ? await tx.query.fakePosBills.findFirst({ where: eq(fakePosBills.id, already.billId) })
        : await tx.query.fakePosBills.findFirst({
            where: and(
              eq(fakePosBills.locationId, locationId),
              eq(fakePosBills.externalTableId, externalTableId),
              eq(fakePosBills.status, 'OPEN'),
            ),
          });
      if (!bill) throw new Error(`No hay cuenta abierta en la mesa ${externalTableId}`);
      if (!already) {
        await tx.insert(fakePosPayments).values({ billId: bill.id, ...payment });
      }
      const { totalCents, paidCents } = await this.toPosBill(bill.id, tx);
      const billClosed = paidCents >= totalCents;
      if (billClosed && bill.status === 'OPEN') {
        await tx
          .update(fakePosBills)
          .set({ status: 'CLOSED', closedAt: new Date() })
          .where(eq(fakePosBills.id, bill.id));
      }
      return { billClosed };
    });
  }

  private async assertUp(locationId: string): Promise<void> {
    if ((await this.health(locationId)) === 'down') throw new PosUnavailableError(locationId);
  }

  private async toPosBill(
    billId: string,
    db: Pick<Database, 'select'> = this.db,
  ): Promise<PosBill> {
    const items = await db
      .select()
      .from(fakePosBillItems)
      .where(eq(fakePosBillItems.billId, billId))
      .orderBy(fakePosBillItems.createdAt);
    const [paid] = await db
      .select({ cents: sql<number>`coalesce(sum(${fakePosPayments.amountCents}), 0)::bigint` })
      .from(fakePosPayments)
      .where(eq(fakePosPayments.billId, billId));
    return {
      externalBillId: billId,
      lines: items.map((i) => ({
        externalLineId: i.id,
        name: i.name,
        qty: i.qty,
        unitPriceCents: i.unitPriceCents,
      })),
      totalCents: items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0),
      paidCents: Number(paid?.cents ?? 0),
    };
  }
}
