import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { CouponView } from '@comercechat/shared-types';
import type { CouponIssuedV1 } from '@comercechat/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import {
  newId,
  safeErrorForLog,
  OutboxRelayService,
  OutboxService,
} from '@comercechat/service-kit';
import { DB, type Database, type Tx } from '../db/client.js';
import { PaymentsDirectory } from '../table-payments/public/payments-directory.js';
import { couponIssuances } from './schema/loyalty.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type IssuedCoupon = typeof couponIssuances.$inferSelect;

const newCode = () =>
  `CC-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

/**
 * Emisión de cupones del comercio (FR-CPN-01, FR-LOY-03). loyalty decide cuándo se emite y lo
 * registra en la misma transacción que el apunte de puntos; table-payments recibe `CouponIssued.v1`
 * y crea el cupón con el mismo id para poder usarlo al pagar (ADR-029). Así nunca hay cupón sin
 * puntos ni puntos sin cupón. Para que el comensal lo vea al momento, tras el commit se entrega
 * también directamente (`deliver`); el evento es la garantía si esa entrega falla.
 */
@Injectable()
export class CouponIssuer implements OnModuleInit {
  private readonly logger = new Logger(CouponIssuer.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly relay: OutboxRelayService,
    private readonly payments: PaymentsDirectory,
  ) {}

  onModuleInit(): void {
    this.relay.on('loyalty', 'CouponRedeemed.v1', async (e) => {
      await this.db
        .update(couponIssuances)
        .set({ redeemedAt: new Date(e.payload.redeemedAt) })
        .where(and(eq(couponIssuances.id, e.payload.couponId), isNull(couponIssuances.redeemedAt)));
    });
  }

  /**
   * Emite un cupón dentro de la transacción del llamante. `null` si la promoción ya le había dado
   * uno a este usuario (índice único parcial).
   */
  async issue(
    tx: Tx,
    c: {
      merchantId: string;
      userId: string;
      title: string;
      discountCents: number;
      minSpendCents?: number;
      validDays: number;
      promotionId?: string;
      rewardId?: string;
    },
  ): Promise<IssuedCoupon | null> {
    const validFrom = new Date();
    const [row] = await tx
      .insert(couponIssuances)
      .values({
        id: newId(),
        merchantId: c.merchantId,
        userId: c.userId,
        promotionId: c.promotionId,
        rewardId: c.rewardId,
        code: newCode(),
        title: c.title,
        discountCents: c.discountCents,
        minSpendCents: c.minSpendCents ?? 0,
        validFrom,
        validTo: new Date(validFrom.getTime() + c.validDays * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    await this.outbox.enqueue(tx, {
      aggregate: 'coupon',
      aggregateId: row.id,
      type: 'CouponIssued.v1',
      payload: toEvent(row),
    });
    return row;
  }

  /**
   * Entrega directa a table-payments de cupones ya confirmados (llamar después del commit). Nunca
   * falla hacia fuera: si no se puede, `CouponIssued.v1` llega por el outbox.
   */
  async deliver(rows: IssuedCoupon[]): Promise<void> {
    for (const row of rows) {
      await this.payments
        .materializeCoupon(toEvent(row))
        .catch((err: unknown) =>
          this.logger.warn(`Cupón ${row.id}: llegará por el outbox (${safeErrorForLog(err)})`),
        );
    }
  }

  toView(c: IssuedCoupon, brandName: string): CouponView {
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      discountCents: c.discountCents,
      minSpendCents: c.minSpendCents,
      validTo: c.validTo.toISOString(),
      status: 'ACTIVE',
      merchant: { id: c.merchantId, brandName },
    };
  }
}

function toEvent(row: IssuedCoupon): CouponIssuedV1 {
  return {
    couponId: row.id,
    code: row.code,
    merchantId: row.merchantId,
    userId: row.userId,
    title: row.title,
    discountCents: row.discountCents,
    minSpendCents: row.minSpendCents,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo.toISOString(),
  };
}
