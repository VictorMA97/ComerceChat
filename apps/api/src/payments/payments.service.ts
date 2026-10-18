import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  type CreatePaymentSessionRequest,
  type PaymentReceipt,
  type PaymentSessionResponse,
  type SplitMode,
  tipFromRequest,
  type TipRequest,
} from '@comercechat/shared-types';
import { and, eq, gt, lt } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { newId } from '../common/ids.js';
import { ENV, type Env, webQrBaseUrl } from '../config/env.js';
import { DB, type Database, type Tx } from '../db/client.js';
import {
  coupons,
  merchants,
  orderAllocations,
  payments,
  pointsLedgerEntries,
  qrCodes,
} from '../db/schema/index.js';
import { DynamicQrService } from '../qr/dynamic-qr.service.js';
import { QueueName, QueueService } from '../queue/queue.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { TableBillService } from '../tables/table-bill.service.js';
import { platformFeeCents, statementDescriptor } from './fees.js';
import { IdempotencyService } from './idempotency.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { paymentStatusToken, isValidPaymentStatusToken } from './status-token.js';
import { CouponsService } from '../loyalty/coupons.service.js';
import { LoyaltyService, pointsFor } from '../loyalty/loyalty.service.js';
import { planSplit, type PlannedAllocation } from './split.js';

interface NewPayment {
  orderId: string;
  locationId: string;
  merchantId: string;
  merchantName: string;
  tableId: string | null;
  qrCodeId: string | null;
  splitMode: SplitMode;
  amountCents: number;
  discountCents: number;
  tipCents: number;
  guestSessionId: string | null;
  userId: string | null;
  couponId: string | null;
  allocations: PlannedAllocation[];
}

/** Cuidado: el importe que cubre el pago (`amountCents`) incluye la parte pagada con cupón. */
const chargedCents = (p: { amountCents: number; discountCents: number }) =>
  p.amountCents - p.discountCents;

type PaymentRow = typeof payments.$inferSelect;

@Injectable()
export class PaymentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly bills: TableBillService,
    private readonly dynamicQr: DynamicQrService,
    private readonly idempotency: IdempotencyService,
    private readonly queues: QueueService,
    private readonly realtime: RealtimeService,
    private readonly coupons: CouponsService,
    private readonly loyalty: LoyaltyService,
  ) {
    this.queues.registerWorker(
      QueueName.MAINTENANCE,
      async (job) => {
        if (job.name === 'expire-payment-sessions') await this.expireSessions();
        if (job.name === 'purge-idempotency-keys') await this.idempotency.purgeExpired();
      },
      1,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.queues.runsWorkers) return;
    const q = this.queues.queue(QueueName.MAINTENANCE);
    await q.upsertJobScheduler(
      'expire-payment-sessions',
      { every: 30_000 },
      { name: 'expire-payment-sessions' },
    );
    await q.upsertJobScheduler(
      'purge-idempotency-keys',
      { every: 60 * 60_000 },
      { name: 'purge-idempotency-keys' },
    );
  }

  /** Crea una sesión de pago: con el QR de la mesa (y reparto) o con el QR de cobro de la caja. */
  createSession(
    req: CreatePaymentSessionRequest,
    idempotencyKey: string | undefined,
    userId: string | null = null,
  ): Promise<PaymentSessionResponse> {
    if (req.couponId && !userId) {
      throw new AppError(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'Inicia sesión para usar tus cupones',
      );
    }
    if (Boolean(req.qrCode) === Boolean(req.dynamicToken)) {
      throw new AppError(
        'BAD_REQUEST',
        HttpStatus.BAD_REQUEST,
        'Indica qrCode o dynamicToken (uno de los dos)',
      );
    }
    return this.idempotency.run('payment-session', idempotencyKey, req, () =>
      req.dynamicToken
        ? this.createPosQrSession(req, idempotencyKey!, userId)
        : this.createTableSession(req, idempotencyKey!, userId),
    );
  }

  private async createTableSession(
    req: CreatePaymentSessionRequest,
    idempotencyKey: string,
    userId: string | null,
  ) {
    const ctx = await this.bills.context(req.qrCode!);
    const posBill = await this.bills.readPosBill(ctx);
    if (!posBill)
      throw new AppError(
        'NOTHING_TO_PAY',
        HttpStatus.CONFLICT,
        'Esta mesa no tiene ninguna cuenta abierta',
      );
    const split = req.split ?? { mode: 'FULL' };

    const { payment, superseded } = await this.db.transaction(async (tx) => {
      // El bloqueo del pedido serializa a los comensales de la misma mesa (ARCHITECTURE §7).
      const order = await this.bills.lockOrderMirror(tx, ctx, posBill);
      const superseded = await this.supersedeGuestSessions(
        tx,
        eq(payments.orderId, order.id),
        req.guestSessionId,
      );
      const state = await this.bills.computeState(tx, posBill, order.id);
      const plan = planSplit(split, state);
      const { discountCents, tipCents } = await this.pricing(tx, {
        req,
        userId,
        merchantId: ctx.merchantId,
        amountCents: plan.amountCents,
        tipsEnabled: ctx.tipConfig.enabled,
      });
      const payment = await this.insertPayment(tx, {
        orderId: order.id,
        locationId: ctx.locationId,
        merchantId: ctx.merchantId,
        merchantName: ctx.qr.merchant.brandName,
        tableId: ctx.tableId,
        qrCodeId: null,
        splitMode: split.mode,
        amountCents: plan.amountCents,
        discountCents,
        tipCents,
        guestSessionId: req.guestSessionId ?? null,
        userId,
        couponId: req.couponId ?? null,
        allocations: plan.allocations,
      });
      return { payment, superseded };
    });

    return this.openProviderSession(payment, ctx.qr.merchant.brandName, superseded, idempotencyKey);
  }

  /**
   * Cobro con el QR que el personal genera desde la caja para una mesa (FR-QR-03): importe firmado,
   * un solo pago por QR y la misma reserva que cualquier otro pago de la mesa (ADR-023).
   */
  private async createPosQrSession(
    req: CreatePaymentSessionRequest,
    idempotencyKey: string,
    userId: string | null,
  ) {
    const dq = await this.dynamicQr.resolve(req.dynamicToken!);
    const ctx = await this.bills.contextForTable(dq.tableId);
    const posBill = await this.bills.readPosBill(ctx);
    if (!posBill) {
      throw new AppError(
        'NOTHING_TO_PAY',
        HttpStatus.CONFLICT,
        'Esta mesa ya no tiene ninguna cuenta abierta',
      );
    }

    const { payment, superseded } = await this.db.transaction(async (tx) => {
      const [qr] = await tx.select().from(qrCodes).where(eq(qrCodes.id, dq.qrId)).for('update');
      if (!qr || qr.status !== 'ACTIVE') {
        throw new AppError(
          'QR_INVALID',
          HttpStatus.NOT_FOUND,
          'Este código QR no es válido o ha caducado',
        );
      }
      const order = await this.bills.lockOrderMirror(tx, ctx, posBill);
      const superseded = await this.supersedeGuestSessions(
        tx,
        eq(payments.qrCodeId, qr.id),
        req.guestSessionId,
      );
      const [inUse] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.qrCodeId, qr.id),
            eq(payments.status, 'CREATED'),
            gt(payments.expiresAt, new Date()),
          ),
        );
      if (inUse) {
        throw new AppError(
          'QR_IN_USE',
          HttpStatus.CONFLICT,
          'Otra persona está pagando este código ahora mismo',
        );
      }
      const state = await this.bills.computeState(tx, posBill, order.id);
      if (dq.amountCents > state.availableCents) {
        throw new AppError(
          'PAYMENT_QR_OUTDATED',
          HttpStatus.CONFLICT,
          'La cuenta de la mesa ha cambiado desde que se generó este QR. Pide al personal uno nuevo.',
        );
      }
      const { discountCents, tipCents } = await this.pricing(tx, {
        req,
        userId,
        merchantId: ctx.merchantId,
        amountCents: dq.amountCents,
        tipsEnabled: ctx.tipConfig.enabled,
      });
      const payment = await this.insertPayment(tx, {
        orderId: order.id,
        locationId: ctx.locationId,
        merchantId: ctx.merchantId,
        merchantName: dq.resolution.merchant.brandName,
        tableId: ctx.tableId,
        qrCodeId: qr.id,
        splitMode: 'POS_QR',
        amountCents: dq.amountCents,
        discountCents,
        tipCents,
        guestSessionId: req.guestSessionId ?? null,
        userId,
        couponId: req.couponId ?? null,
        allocations: [{ kind: 'AMOUNT', amountCents: dq.amountCents }],
      });
      return { payment, superseded };
    });
    return this.openProviderSession(
      payment,
      dq.resolution.merchant.brandName,
      superseded,
      idempotencyKey,
    );
  }

  /** Un nuevo intento desde el mismo dispositivo libera sus sesiones anteriores sin pagar. */
  private async supersedeGuestSessions(
    tx: Tx,
    scope: ReturnType<typeof eq>,
    guestSessionId: string | undefined,
  ) {
    if (!guestSessionId) return [];
    const old = await tx
      .update(payments)
      .set({ status: 'FAILED', failureReason: 'SUPERSEDED' })
      .where(
        and(scope, eq(payments.guestSessionId, guestSessionId), eq(payments.status, 'CREATED')),
      )
      .returning({ id: payments.id, pspPaymentId: payments.pspPaymentId });
    await TableBillService.releaseAllocations(
      tx,
      old.map((p) => p.id),
    );
    return old;
  }

  /**
   * Descuento del cupón (si lo hay) y propina sobre lo que realmente paga el comensal. El cupón se
   * valida aquí y se reserva de forma atómica en `insertPayment`.
   */
  private async pricing(
    tx: Tx,
    p: {
      req: CreatePaymentSessionRequest;
      userId: string | null;
      merchantId: string;
      amountCents: number;
      tipsEnabled: boolean;
    },
  ): Promise<{ discountCents: number; tipCents: number }> {
    const discountCents =
      p.req.couponId && p.userId
        ? (
            await this.coupons.discountFor(tx, {
              couponId: p.req.couponId,
              userId: p.userId,
              merchantId: p.merchantId,
              amountCents: p.amountCents,
            })
          ).discountCents
        : 0;
    return {
      discountCents,
      tipCents: this.validateTip(p.amountCents - discountCents, p.req.tip, p.tipsEnabled),
    };
  }

  /** `amountCents`: lo que paga el comensal sin propina (ya descontado el cupón). */
  private validateTip(amountCents: number, tip: TipRequest, tipsEnabled: boolean): number {
    const valid =
      (tip.kind === 'percent' &&
        Number.isFinite(tip.value) &&
        tip.value >= 0 &&
        tip.value <= 100) ||
      (tip.kind === 'amount' && Number.isInteger(tip.cents) && tip.cents >= 0);
    if (!valid)
      throw new AppError('TIP_INVALID', HttpStatus.UNPROCESSABLE_ENTITY, 'Propina no válida');
    const tipCents = tipFromRequest(amountCents, tip);
    if (tipCents > 0 && !tipsEnabled) {
      throw new AppError(
        'TIPS_DISABLED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Este local no acepta propinas',
      );
    }
    if (tipCents > amountCents) {
      throw new AppError(
        'TIP_TOO_HIGH',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La propina no puede superar el importe',
      );
    }
    if (amountCents + tipCents > this.env.GUEST_MAX_PAYMENT_CENTS) {
      throw new AppError(
        'GUEST_LIMIT_EXCEEDED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El importe supera el máximo para pagar sin cuenta. Divide la cuenta o pídela al personal.',
      );
    }
    return tipCents;
  }

  private async insertPayment(tx: Tx, p: NewPayment): Promise<PaymentRow> {
    const expiresAt = new Date(Date.now() + this.env.PAYMENT_SESSION_TTL_SECONDS * 1000);
    const [payment] = await tx
      .insert(payments)
      .values({
        id: newId(),
        orderId: p.orderId,
        locationId: p.locationId,
        merchantId: p.merchantId,
        tableId: p.tableId,
        qrCodeId: p.qrCodeId,
        psp: this.provider.name,
        userId: p.userId,
        amountCents: p.amountCents,
        discountCents: p.discountCents,
        tipCents: p.tipCents,
        // Comisión sobre lo que paga el comensal, sin propina ni la parte del cupón (FR-PAY-10).
        platformFeeCents: platformFeeCents(
          chargedCents(p),
          this.env.PLATFORM_FEE_BPS,
          this.env.PLATFORM_FEE_FIXED_CENTS,
        ),
        statementDescriptor: statementDescriptor(p.merchantName),
        splitMode: p.splitMode,
        guestSessionId: p.guestSessionId,
        expiresAt,
      })
      .returning();
    await tx.insert(orderAllocations).values(
      p.allocations.map((a) => ({
        orderId: p.orderId,
        paymentId: payment!.id,
        kind: a.kind,
        posLineId: a.posLineId ?? null,
        units: a.units ?? null,
        amountCents: a.amountCents,
        expiresAt,
      })),
    );
    if (p.couponId && p.userId) {
      // Reserva atómica del cupón (FR-CPN-06): si otro pago lo ha reservado, se revierte todo.
      await this.coupons.reserve(tx, p.couponId, p.userId, payment!.id, expiresAt);
    }
    return payment!;
  }

  private async openProviderSession(
    payment: PaymentRow,
    merchantName: string,
    superseded: { pspPaymentId: string | null }[],
    idempotencyKey: string,
  ): Promise<PaymentSessionResponse> {
    await this.cancelAtProvider(superseded);
    const merchant = await this.db.query.merchants.findFirst({
      where: eq(merchants.id, payment.merchantId),
    });
    const statusToken = this.statusToken(payment.id);
    try {
      const session = await this.provider.createPaymentSession({
        paymentId: payment.id,
        pspAccountId: merchant?.pspAccountId ?? null,
        totalCents: chargedCents(payment) + payment.tipCents,
        platformFeeCents: payment.platformFeeCents,
        currency: 'EUR',
        statementDescriptor: payment.statementDescriptor,
        merchantName,
        returnUrl: `${webQrBaseUrl(this.env).replace(/\/$/, '')}/p/${payment.id}?t=${statusToken}`,
        expiresAt: payment.expiresAt,
        idempotencyKey,
      });
      await this.db
        .update(payments)
        .set({ pspPaymentId: session.pspPaymentId })
        .where(eq(payments.id, payment.id));
      await this.publishFor(payment, 'payment.started');
      return {
        paymentId: payment.id,
        statusToken,
        checkoutUrl: session.checkoutUrl,
        amountCents: payment.amountCents,
        discountCents: payment.discountCents,
        tipCents: payment.tipCents,
        splitMode: payment.splitMode as SplitMode,
        expiresAt: payment.expiresAt.toISOString(),
      };
    } catch (err) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: 'FAILED', failureReason: 'PSP_SESSION_ERROR' })
          .where(eq(payments.id, payment.id));
        await TableBillService.releaseAllocations(tx, [payment.id]);
      });
      throw err;
    }
  }

  /** El comensal abandona el pago desde la página de estado: libera su parte de la cuenta. */
  async cancelByPayer(paymentId: string, token: string | undefined): Promise<PaymentReceipt> {
    this.assertToken(paymentId, token);
    const cancelled = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(payments)
        .set({ status: 'FAILED', failureReason: 'CANCELLED_BY_PAYER' })
        .where(and(eq(payments.id, paymentId), eq(payments.status, 'CREATED')))
        .returning();
      await TableBillService.releaseAllocations(
        tx,
        rows.map((p) => p.id),
      );
      return rows;
    });
    await this.cancelAtProvider(cancelled);
    for (const p of cancelled) await this.publishFor(p, 'payment.cancelled');
    return this.receipt(paymentId, token);
  }

  /** Estado y justificante del pago para el comensal (FR-PAY-05/06). Requiere el token del pago. */
  async receipt(paymentId: string, token: string | undefined): Promise<PaymentReceipt> {
    this.assertToken(paymentId, token);
    const p = await this.db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: { merchant: true, location: true, table: true },
    });
    if (!p) throw new AppError('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND, 'Pago no encontrado');
    const [coupon] = await this.db
      .select({ title: coupons.title })
      .from(coupons)
      .where(eq(coupons.reservedPaymentId, p.id))
      .limit(1);
    return {
      paymentId: p.id,
      status: p.status,
      failureReason: p.failureReason,
      merchant: { brandName: p.merchant.brandName },
      location: { name: p.location.name, address: p.location.address },
      table: p.table ? { label: p.table.label } : null,
      amountCents: p.amountCents,
      discountCents: p.discountCents,
      couponTitle: coupon?.title ?? null,
      tipCents: p.tipCents,
      totalCents: chargedCents(p) + p.tipCents,
      currency: 'EUR',
      method: p.method,
      cardLast4: p.cardLast4,
      capturedAt: p.capturedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      points: await this.pointsInfo(p),
    };
  }

  /** Puntos del pago para el justificante (FR-LOY-02, FR-USR-02). */
  private async pointsInfo(p: PaymentRow): Promise<PaymentReceipt['points']> {
    const program = await this.loyalty.programFor(p.merchantId);
    if (!program) return null;
    const [earned] = await this.db
      .select({ points: pointsLedgerEntries.points })
      .from(pointsLedgerEntries)
      .where(and(eq(pointsLedgerEntries.paymentId, p.id), eq(pointsLedgerEntries.type, 'EARN')));
    const claimWindowOpen =
      p.capturedAt !== null && Date.now() - p.capturedAt.getTime() < 24 * 60 * 60 * 1000;
    return {
      merchantId: p.merchantId,
      points: earned?.points ?? pointsFor(program, chargedCents(p)),
      claimed: Boolean(earned),
      claimable: p.status === 'CAPTURED' && !p.userId && claimWindowOpen,
    };
  }

  /** Caduca las sesiones sin confirmar, libera su parte de la cuenta y las cancela en el PSP. */
  async expireSessions(): Promise<number> {
    const expired = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(payments)
        .set({ status: 'FAILED', failureReason: 'EXPIRED' })
        .where(and(eq(payments.status, 'CREATED'), lt(payments.expiresAt, new Date())))
        .returning();
      await TableBillService.releaseAllocations(
        tx,
        rows.map((p) => p.id),
      );
      return rows;
    });
    await this.cancelAtProvider(expired);
    for (const p of expired) await this.publishFor(p, 'payment.expired');
    return expired.length;
  }

  /** Avisa en tiempo real a la mesa afectada por un pago. */
  async publishFor(
    p: Pick<PaymentRow, 'locationId' | 'tableId' | 'qrCodeId'>,
    reason: string,
  ): Promise<void> {
    await this.realtime.publish({
      type: 'table.updated',
      locationId: p.locationId,
      tableId: p.tableId ?? undefined,
      qrId: p.qrCodeId ?? undefined,
      reason,
    });
  }

  private async cancelAtProvider(rows: { pspPaymentId: string | null }[]): Promise<void> {
    await Promise.all(
      rows
        .filter((r) => r.pspPaymentId)
        .map((r) =>
          this.provider
            .cancelPaymentSession(r.pspPaymentId!)
            .catch((e: unknown) => this.logger.warn(String(e))),
        ),
    );
  }

  private statusToken(paymentId: string): string {
    return paymentStatusToken(this.env.JWT_SECRET, paymentId);
  }

  private assertToken(paymentId: string, token: string | undefined): void {
    if (!isValidPaymentStatusToken(this.env.JWT_SECRET, paymentId, token)) {
      throw new AppError('PAYMENT_NOT_FOUND', HttpStatus.NOT_FOUND, 'Pago no encontrado');
    }
  }
}
