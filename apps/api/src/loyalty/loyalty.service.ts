import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClaimPointsResponse, CouponView, LoyaltyView } from '@comercechat/shared-types';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Database, type Tx } from '../db/client.js';
import {
  loyaltyAccounts,
  loyaltyPrograms,
  loyaltyRewards,
  merchants,
  payments,
  pointsLedgerEntries,
  promotions,
} from '../db/schema/index.js';
import { type DomainEventJob, OutboxRelayService } from '../outbox/outbox-relay.service.js';
import { isValidPaymentStatusToken } from '../payments/status-token.js';
import { QueueName, QueueService } from '../queue/queue.service.js';
import { CouponsService } from './coupons.service.js';

/** Plazo para reclamar los puntos de un pago hecho sin cuenta (FR-USR-02). */
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const REWARD_COUPON_VALID_DAYS = 30;

type ProgramRow = typeof loyaltyPrograms.$inferSelect;

/** Puntos que genera un importe pagado (sin propina): floor(€ × puntos por euro) (FR-LOY-02). */
export const pointsFor = (program: Pick<ProgramRow, 'earnRule'>, paidCents: number): number =>
  Math.max(0, Math.floor((paidCents / 100) * program.earnRule.pointsPerEuro));

@Injectable()
export class LoyaltyService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly coupons: CouponsService,
    private readonly relay: OutboxRelayService,
    private readonly queues: QueueService,
  ) {
    this.queues.registerWorker(QueueName.LOYALTY, () => this.releasePending(), 1);
  }

  onModuleInit(): void {
    // Puntos automáticos para pagos de usuarios identificados. Idempotente (índice único por pago).
    this.relay.on('PaymentCaptured', (e: DomainEventJob) =>
      this.earnForPayment(e.payload.paymentId as string).then(() => undefined),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.queues.runsWorkers) return;
    await this.queues
      .queue(QueueName.LOYALTY)
      .upsertJobScheduler(
        'release-pending-points',
        { every: 5 * 60_000 },
        { name: 'release-pending-points' },
      );
  }

  async programFor(
    merchantId: string,
    db: Pick<Database, 'query'> = this.db,
  ): Promise<ProgramRow | null> {
    return (
      (await db.query.loyaltyPrograms.findFirst({
        where: and(
          eq(loyaltyPrograms.merchantId, merchantId),
          eq(loyaltyPrograms.status, 'ACTIVE'),
        ),
      })) ?? null
    );
  }

  /**
   * Asigna los puntos de un pago capturado a su usuario. Devuelve los puntos nuevos (0 si ya se
   * habían dado) y los cupones de bienvenida emitidos si es su primera visita al comercio.
   */
  async earnForPayment(
    paymentId: string,
    tx?: Tx,
  ): Promise<{ points: number; newCoupons: CouponView[] }> {
    const run = async (t: Tx) => {
      const [p] = await t.select().from(payments).where(eq(payments.id, paymentId));
      if (!p || p.status !== 'CAPTURED' || !p.userId) return { points: 0, newCoupons: [] };
      const program = await this.programFor(p.merchantId, t);
      if (!program) return { points: 0, newCoupons: [] };
      const points = pointsFor(program, p.amountCents - p.discountCents);
      const account = await this.lockAccount(t, p.userId, program.id);

      const [previous] = await t
        .select({ n: sql<number>`count(*)::int` })
        .from(pointsLedgerEntries)
        .where(
          and(eq(pointsLedgerEntries.accountId, account.id), eq(pointsLedgerEntries.type, 'EARN')),
        );

      const status = program.holdHours > 0 ? 'PENDING' : 'AVAILABLE';
      const [entry] = await t
        .insert(pointsLedgerEntries)
        .values({
          accountId: account.id,
          type: 'EARN',
          points,
          status,
          paymentId: p.id,
          availableAt: new Date(Date.now() + program.holdHours * 3_600_000),
        })
        .onConflictDoNothing()
        .returning();
      if (!entry) return { points: 0, newCoupons: [] };
      if (status === 'AVAILABLE') await this.addToBalance(t, account.id, points);

      const newCoupons =
        (previous?.n ?? 0) === 0 ? await this.issueWelcomeCoupons(t, p.merchantId, p.userId) : [];
      return { points, newCoupons };
    };
    return tx ? run(tx) : this.db.transaction(run);
  }

  /**
   * Reclamar los puntos de un pago hecho sin cuenta (FR-USR-02): hace falta el token del pago, que
   * esté capturado, que no sea de otro usuario y que no hayan pasado 24 h.
   */
  async claim(
    userId: string,
    paymentId: string,
    statusToken: string,
  ): Promise<ClaimPointsResponse> {
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
      if (!p.userId) await tx.update(payments).set({ userId }).where(eq(payments.id, p.id));
      const { points, newCoupons } = await this.earnForPayment(p.id, tx);
      const merchant = await tx.query.merchants.findFirst({
        where: eq(merchants.id, p.merchantId),
      });
      const program = await this.programFor(p.merchantId, tx);
      const account = program
        ? await tx.query.loyaltyAccounts.findFirst({
            where: and(
              eq(loyaltyAccounts.userId, userId),
              eq(loyaltyAccounts.programId, program.id),
            ),
          })
        : undefined;
      return {
        pointsEarned: points,
        balance: account?.balanceCached ?? 0,
        merchant: { id: p.merchantId, brandName: merchant?.brandName ?? '' },
        newCoupons,
      };
    });
  }

  /** Canjea una recompensa por un cupón de un solo uso (FR-LOY-03). */
  async redeemReward(userId: string, rewardId: string): Promise<CouponView> {
    return this.db.transaction(async (tx) => {
      const reward = await tx.query.loyaltyRewards.findFirst({
        where: and(eq(loyaltyRewards.id, rewardId), eq(loyaltyRewards.active, true)),
        with: { program: { with: { merchant: true } } },
      });
      if (!reward)
        throw new AppError('REWARD_NOT_FOUND', HttpStatus.NOT_FOUND, 'Recompensa no encontrada');
      const account = await this.lockAccount(tx, userId, reward.programId);
      if (account.balanceCached < reward.costPoints) {
        throw new AppError(
          'NOT_ENOUGH_POINTS',
          HttpStatus.CONFLICT,
          `Te faltan ${reward.costPoints - account.balanceCached} puntos`,
        );
      }
      const coupon = await this.coupons.issue(tx, {
        merchantId: reward.program.merchantId,
        userId,
        title: reward.name,
        discountCents: reward.discountCents,
        validDays: REWARD_COUPON_VALID_DAYS,
        rewardId: reward.id,
      });
      await tx.insert(pointsLedgerEntries).values({
        accountId: account.id,
        type: 'REDEEM',
        points: -reward.costPoints,
        status: 'AVAILABLE',
        couponId: coupon!.id,
        reason: `Recompensa: ${reward.name}`,
      });
      await this.addToBalance(tx, account.id, -reward.costPoints);
      return this.coupons.toView(coupon!, reward.program.merchant.brandName);
    });
  }

  async view(userId: string): Promise<LoyaltyView[]> {
    const accounts = await this.db.query.loyaltyAccounts.findMany({
      where: eq(loyaltyAccounts.userId, userId),
      with: { program: { with: { merchant: true, rewards: true } } },
    });
    const pending = accounts.length
      ? await this.db
          .select({
            accountId: pointsLedgerEntries.accountId,
            points: sql<number>`coalesce(sum(${pointsLedgerEntries.points}), 0)::int`,
          })
          .from(pointsLedgerEntries)
          .where(
            and(
              inArray(
                pointsLedgerEntries.accountId,
                accounts.map((a) => a.id),
              ),
              eq(pointsLedgerEntries.status, 'PENDING'),
            ),
          )
          .groupBy(pointsLedgerEntries.accountId)
      : [];
    return accounts.map((a) => ({
      merchant: { id: a.program.merchant.id, brandName: a.program.merchant.brandName },
      balance: a.balanceCached,
      pendingPoints: pending.find((p) => p.accountId === a.id)?.points ?? 0,
      pointsPerEuro: a.program.earnRule.pointsPerEuro,
      rewards: a.program.rewards
        .filter((r) => r.active)
        .sort((x, y) => x.costPoints - y.costPoints)
        .map((r) => ({
          id: r.id,
          name: r.name,
          costPoints: r.costPoints,
          discountCents: r.discountCents,
        })),
    }));
  }

  /** PENDING → AVAILABLE pasado el periodo de retención (ARCHITECTURE §13). */
  async releasePending(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .update(pointsLedgerEntries)
        .set({ status: 'AVAILABLE' })
        .where(
          and(
            eq(pointsLedgerEntries.status, 'PENDING'),
            lte(pointsLedgerEntries.availableAt, new Date()),
          ),
        )
        .returning();
      for (const e of due) await this.addToBalance(tx, e.accountId, e.points);
      return due.length;
    });
  }

  private async lockAccount(tx: Tx, userId: string, programId: string) {
    await tx.insert(loyaltyAccounts).values({ userId, programId }).onConflictDoNothing();
    const [account] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(and(eq(loyaltyAccounts.userId, userId), eq(loyaltyAccounts.programId, programId)))
      .for('update');
    return account!;
  }

  private async addToBalance(tx: Tx, accountId: string, delta: number): Promise<void> {
    await tx
      .update(loyaltyAccounts)
      .set({ balanceCached: sql`${loyaltyAccounts.balanceCached} + ${delta}` })
      .where(eq(loyaltyAccounts.id, accountId));
  }

  /** «Vuelve y te invitamos» (FR-CPN-01): cupón para la próxima visita tras la primera. */
  private async issueWelcomeCoupons(
    tx: Tx,
    merchantId: string,
    userId: string,
  ): Promise<CouponView[]> {
    const active = await tx
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.merchantId, merchantId),
          eq(promotions.template, 'COMEBACK'),
          eq(promotions.status, 'ACTIVE'),
        ),
      );
    const merchant = active.length
      ? await tx.query.merchants.findFirst({ where: eq(merchants.id, merchantId) })
      : null;
    const issued: CouponView[] = [];
    for (const promo of active) {
      const coupon = await this.coupons.issue(tx, {
        merchantId,
        userId,
        title: promo.name,
        discountCents: promo.rules.discountCents,
        minSpendCents: promo.rules.minSpendCents,
        validDays: promo.rules.validDays,
        promotionId: promo.id,
      });
      if (coupon) issued.push(this.coupons.toView(coupon, merchant?.brandName ?? ''));
    }
    if (issued.length)
      this.logger.log(`Cupones de bienvenida para el usuario ${userId}: ${issued.length}`);
    return issued;
  }
}
