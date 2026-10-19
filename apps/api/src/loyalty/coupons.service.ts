import { HttpStatus, Injectable } from '@nestjs/common';
import type { CouponView } from '@comercechat/shared-types';
import { and, eq, gt, inArray, lte } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { formatEur } from '../common/money.js';
import type { Database, Tx } from '../db/client.js';
import { couponRedemptions, coupons, merchants } from '../db/schema/index.js';

type Reader = Pick<Database, 'select'>;
type CouponRow = typeof coupons.$inferSelect;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () =>
  `CC-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

/**
 * Un cupón solo está disponible si está ACTIVE. Un cupón RESERVED vuelve a ACTIVE únicamente cuando
 * su pago termina sin cobrarse (`release`, desde `TableBillService.releaseAllocations`): que la
 * reserva haya caducado no basta, porque el PSP aún puede capturar ese pago y el descuento se
 * aplicaría dos veces.
 */
const available = () => eq(coupons.status, 'ACTIVE');

/** Cupones de un solo uso, financiados por el comercio (FR-CPN-04…06, REG-04). */
@Injectable()
export class CouponsService {
  async issue(
    db: Pick<Database, 'insert'>,
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
  ): Promise<CouponRow | null> {
    const [row] = await db
      .insert(coupons)
      .values({
        merchantId: c.merchantId,
        userId: c.userId,
        promotionId: c.promotionId,
        rewardId: c.rewardId,
        code: newCode(),
        title: c.title,
        discountCents: c.discountCents,
        minSpendCents: c.minSpendCents ?? 0,
        validTo: new Date(Date.now() + c.validDays * 24 * 60 * 60 * 1000),
      })
      // Una promoción emite un solo cupón por usuario (índice único parcial).
      .onConflictDoNothing()
      .returning();
    return row ?? null;
  }

  /** Cupones que el usuario puede usar ahora (opcionalmente, en un comercio). */
  async listForUser(db: Reader, userId: string, merchantId?: string): Promise<CouponView[]> {
    const now = new Date();
    const rows = await db
      .select({ coupon: coupons, brandName: merchants.brandName })
      .from(coupons)
      .innerJoin(merchants, eq(merchants.id, coupons.merchantId))
      .where(
        and(
          eq(coupons.userId, userId),
          merchantId ? eq(coupons.merchantId, merchantId) : undefined,
          available(),
          lte(coupons.validFrom, now),
          gt(coupons.validTo, now),
        ),
      )
      .orderBy(coupons.validTo);
    return rows.map(({ coupon, brandName }) => this.toView(coupon, brandName));
  }

  /**
   * Comprueba que el cupón se puede aplicar y devuelve el descuento. La reserva real la hace
   * `reserve()` dentro de la transacción del pago, de forma atómica.
   */
  async discountFor(
    db: Reader,
    p: { couponId: string; userId: string; merchantId: string; amountCents: number },
  ): Promise<{ discountCents: number; title: string }> {
    const [c] = await db.select().from(coupons).where(eq(coupons.id, p.couponId));
    const now = Date.now();
    if (
      !c ||
      c.userId !== p.userId ||
      c.merchantId !== p.merchantId ||
      c.validFrom.getTime() > now ||
      c.validTo.getTime() <= now
    ) {
      throw new AppError(
        'COUPON_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'Este cupón no se puede usar aquí',
      );
    }
    if (p.amountCents < c.minSpendCents) {
      throw new AppError(
        'COUPON_MIN_SPEND',
        HttpStatus.CONFLICT,
        `Este cupón requiere pagar al menos ${formatEur(c.minSpendCents)}`,
      );
    }
    return { discountCents: Math.min(c.discountCents, p.amountCents), title: c.title };
  }

  /**
   * Reserva atómica (FR-CPN-06): ACTIVE → RESERVED con un UPDATE condicional. Si dos pagos lo
   * intentan a la vez, solo uno actualiza la fila; el otro recibe COUPON_UNAVAILABLE.
   */
  async reserve(
    tx: Tx,
    couponId: string,
    userId: string,
    paymentId: string,
    until: Date,
  ): Promise<void> {
    const [row] = await tx
      .update(coupons)
      .set({ status: 'RESERVED', reservedPaymentId: paymentId, reservedUntil: until })
      .where(and(eq(coupons.id, couponId), eq(coupons.userId, userId), available()))
      .returning({ id: coupons.id });
    if (!row) {
      throw new AppError(
        'COUPON_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'Este cupón ya se ha usado o se está usando en otro pago',
      );
    }
  }

  /** Devuelve a ACTIVE los cupones reservados por pagos que no se completaron. */
  static async release(tx: Tx, paymentIds: string[]): Promise<void> {
    if (paymentIds.length === 0) return;
    await tx
      .update(coupons)
      .set({ status: 'ACTIVE', reservedPaymentId: null, reservedUntil: null })
      .where(and(inArray(coupons.reservedPaymentId, paymentIds), eq(coupons.status, 'RESERVED')));
  }

  /**
   * Canje definitivo al capturarse el pago. La unicidad de coupon_id impide canjearlo dos veces.
   * Devuelve cuántos cupones ha canjeado: 0 en un pago con descuento es una anomalía.
   */
  static async redeem(tx: Tx, paymentId: string, discountCents: number): Promise<number> {
    const reserved = await tx
      .update(coupons)
      .set({ status: 'REDEEMED' })
      .where(
        and(
          eq(coupons.reservedPaymentId, paymentId),
          inArray(coupons.status, ['RESERVED', 'ACTIVE']),
        ),
      )
      .returning({ id: coupons.id });
    for (const c of reserved) {
      await tx
        .insert(couponRedemptions)
        .values({ couponId: c.id, paymentId, discountCents })
        .onConflictDoNothing();
    }
    return reserved.length;
  }

  toView(c: CouponRow, brandName: string): CouponView {
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      discountCents: c.discountCents,
      minSpendCents: c.minSpendCents,
      validTo: c.validTo.toISOString(),
      status: c.status,
      merchant: { id: c.merchantId, brandName },
    };
  }
}
