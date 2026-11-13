import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { DynamicQrView } from '@comercechat/shared-types';
import type { CouponIssuedV1 } from '@comercechat/contracts';
import { and, eq } from 'drizzle-orm';
import { AppError, OutboxService } from '@comercechat/service-kit';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/client.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { DynamicQrService } from '../dynamic-qr/dynamic-qr.service.js';
import { isValidPaymentStatusToken } from '../payments/status-token.js';
import { payments } from '../schema/payments.js';

/** Plazo para reclamar los puntos de un pago hecho sin cuenta (FR-USR-02). */
export const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Pago capturado, con lo que necesitan otros contextos (puntos, analítica). */
export interface CapturedPayment {
  id: string;
  merchantId: string;
  locationId: string;
  tableId: string | null;
  userId: string | null;
  /** Lo que cubre el pago, incluida la parte pagada con cupón. */
  amountCents: number;
  discountCents: number;
  tipCents: number;
  platformFeeCents: number;
  currency: string;
  capturedAt: Date;
}

/**
 * API pública de table-payments para el resto de contextos (ADR-029). Con servicios separados será
 * `/internal/...` de table-payments (MIGRACION §3.3).
 */
@Injectable()
export class PaymentsDirectory {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly dynamicQr: DynamicQrService,
    private readonly outbox: OutboxService,
    private readonly coupons: CouponsService,
  ) {}

  /**
   * Crea ya el cupón que acaba de emitir loyalty, sin esperar a `CouponIssued.v1` (vía rápida tras su
   * commit; con servicios separados, `POST /internal/coupons`). Idempotente por id: si después llega
   * el evento, no hace nada. Si esta llamada falla, el evento lo entrega igualmente.
   */
  materializeCoupon(c: CouponIssuedV1): Promise<void> {
    return this.coupons.materialize(c);
  }

  /**
   * Asigna un pago hecho sin cuenta a un comensal para que reclame sus puntos (FR-USR-02): hace
   * falta el token del pago, que esté capturado, que no sea de otro usuario y que no hayan pasado
   * 24 h. Repetirlo con el mismo usuario devuelve el mismo pago, también pasado el plazo, para que
   * loyalty pueda reintentar el apunte.
   */
  async claimForUser(
    paymentId: string,
    userId: string,
    statusToken: string,
  ): Promise<CapturedPayment> {
    if (!isValidPaymentStatusToken(this.env.PAYMENT_STATUS_SECRET, paymentId, statusToken)) {
      throw new AppError('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND, 'Pago no encontrado');
    }
    return this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
      if (!p || p.status !== 'CAPTURED' || !p.capturedAt) {
        throw new AppError(
          'CLAIM_NOT_ALLOWED',
          HttpStatus.CONFLICT,
          'Este pago todavía no se ha completado',
        );
      }
      if (p.userId && p.userId !== userId) {
        throw new AppError(
          'CLAIM_NOT_ALLOWED',
          HttpStatus.CONFLICT,
          'Los puntos de este pago ya tienen dueño',
        );
      }
      if (!p.userId && Date.now() - p.capturedAt.getTime() > CLAIM_WINDOW_MS) {
        throw new AppError(
          'CLAIM_EXPIRED',
          HttpStatus.CONFLICT,
          'Han pasado más de 24 h desde el pago',
        );
      }
      if (!p.userId) {
        await tx
          .update(payments)
          .set({ userId })
          .where(and(eq(payments.id, p.id), eq(payments.status, 'CAPTURED')));
        await this.outbox.enqueue(tx, {
          aggregate: 'payment',
          aggregateId: p.id,
          type: 'PaymentUserAssigned.v1',
          payload: { paymentId: p.id, merchantId: p.merchantId, userId },
        });
      }
      return toCaptured({ ...p, userId });
    });
  }

  /** Último QR de cobro de cada mesa, para el simulador de caja (ADR-023). */
  paymentQrsForTables(tableIds: string[]): Promise<Map<string, DynamicQrView>> {
    return this.dynamicQr.latestForTables(tableIds);
  }
}

function toCaptured(p: typeof payments.$inferSelect): CapturedPayment {
  return {
    id: p.id,
    merchantId: p.merchantId,
    locationId: p.locationId,
    tableId: p.tableId,
    userId: p.userId,
    amountCents: p.amountCents,
    discountCents: p.discountCents,
    tipCents: p.tipCents,
    platformFeeCents: p.platformFeeCents,
    currency: p.currency,
    capturedAt: p.capturedAt!,
  };
}
