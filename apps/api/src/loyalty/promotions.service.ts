import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CreatePromotionRequest, PromotionView } from '@comercechat/shared-types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DB, type Database } from '../db/client.js';
import { coupons, promotions } from '../db/schema/index.js';

/** Promociones del comercio. En la PoC, la plantilla «Vuelve y te invitamos» (FR-CPN-01). */
@Injectable()
export class PromotionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(merchantId: string): Promise<PromotionView[]> {
    const rows = await this.db
      .select({
        p: promotions,
        issued: sql<number>`count(${coupons.id})::int`,
        redeemed: sql<number>`count(${coupons.id}) filter (where ${coupons.status} = 'REDEEMED')::int`,
      })
      .from(promotions)
      .leftJoin(coupons, eq(coupons.promotionId, promotions.id))
      .where(eq(promotions.merchantId, merchantId))
      .groupBy(promotions.id)
      .orderBy(desc(promotions.createdAt));
    return rows.map(({ p, issued, redeemed }) => ({
      id: p.id,
      template: p.template,
      name: p.name,
      discountCents: p.rules.discountCents,
      minSpendCents: p.rules.minSpendCents,
      validDays: p.rules.validDays,
      status: p.status,
      issued,
      redeemed,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /** Crea la promoción y termina la anterior de la misma plantilla (una activa a la vez). */
  async create(m: MerchantPrincipal, req: CreatePromotionRequest): Promise<PromotionView> {
    const valid =
      req.name.trim().length >= 3 &&
      Number.isInteger(req.discountCents) &&
      req.discountCents >= 50 &&
      req.discountCents <= 5_000 &&
      Number.isInteger(req.minSpendCents) &&
      req.minSpendCents >= 0 &&
      Number.isInteger(req.validDays) &&
      req.validDays >= 1 &&
      req.validDays <= 365;
    if (!valid) {
      throw new AppError(
        'PROMOTION_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Revisa los datos de la promoción',
      );
    }
    const created = await this.db.transaction(async (tx) => {
      await tx
        .update(promotions)
        .set({ status: 'ENDED', endsAt: new Date() })
        .where(
          and(
            eq(promotions.merchantId, m.merchantId),
            eq(promotions.template, 'COMEBACK'),
            eq(promotions.status, 'ACTIVE'),
          ),
        );
      const [p] = await tx
        .insert(promotions)
        .values({
          merchantId: m.merchantId,
          template: 'COMEBACK',
          name: req.name.trim(),
          rules: {
            discountCents: req.discountCents,
            minSpendCents: req.minSpendCents,
            validDays: req.validDays,
          },
        })
        .returning();
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: m.merchantUserId,
          action: 'promotion.created',
          entity: 'promotion',
          entityId: p!.id,
          after: req,
        },
        tx,
      );
      return p!;
    });
    return (await this.list(m.merchantId)).find((p) => p.id === created.id)!;
  }

  async end(m: MerchantPrincipal, promotionId: string): Promise<void> {
    await this.db
      .update(promotions)
      .set({ status: 'ENDED', endsAt: new Date() })
      .where(and(eq(promotions.id, promotionId), eq(promotions.merchantId, m.merchantId)));
  }
}
