import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/client.js';
import { loyaltyPrograms, pointsLedgerEntries } from '../schema/loyalty.js';

type ProgramRow = typeof loyaltyPrograms.$inferSelect;

/** Puntos que genera un importe pagado (sin propina): floor(€ × puntos por euro) (FR-LOY-02). */
export const pointsFor = (program: Pick<ProgramRow, 'earnRule'>, paidCents: number): number =>
  Math.max(0, Math.floor((paidCents / 100) * program.earnRule.pointsPerEuro));

/**
 * API pública de loyalty para el resto de contextos (ADR-029). Con servicios separados será
 * `/internal/...` de loyalty (MIGRACION §3.3).
 */
@Injectable()
export class LoyaltyDirectory {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Puntos de un pago para su justificante (FR-LOY-02): los ya apuntados o, si aún no lo están, los
   * que generará. `null` si el comercio no tiene programa activo.
   */
  async receiptPoints(p: {
    paymentId: string;
    merchantId: string;
    /** Lo que paga el comensal sin propina ni la parte del cupón. */
    chargedCents: number;
  }): Promise<{ points: number; earned: boolean } | null> {
    const program = await this.db.query.loyaltyPrograms.findFirst({
      where: and(
        eq(loyaltyPrograms.merchantId, p.merchantId),
        eq(loyaltyPrograms.status, 'ACTIVE'),
      ),
    });
    if (!program) return null;
    const [earned] = await this.db
      .select({ points: pointsLedgerEntries.points })
      .from(pointsLedgerEntries)
      .where(
        and(eq(pointsLedgerEntries.paymentId, p.paymentId), eq(pointsLedgerEntries.type, 'EARN')),
      );
    return {
      points: earned?.points ?? pointsFor(program, p.chargedCents),
      earned: Boolean(earned),
    };
  }
}
