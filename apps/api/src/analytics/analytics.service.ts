import { Inject, Injectable } from '@nestjs/common';
import type { AnalyticsPeriod, AnalyticsTotals, AnalyticsView } from '@comercechat/shared-types';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { payments } from '../db/schema/index.js';

const DAYS: Record<AnalyticsPeriod, number> = { today: 1, week: 7, month: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Panel de inicio del comercio (FR-ANA-01, versión reducida de la PoC): consultas directas a
 * `payments`, sin vistas materializadas. Los días se cuentan en hora de Madrid.
 */
@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async view(merchantId: string, period: AnalyticsPeriod): Promise<AnalyticsView> {
    const { rows } = await this.db.execute(
      sql`select (date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid') as "todayStart"`,
    );
    const todayStart = (rows[0] as { todayStart: Date }).todayStart;
    const to = new Date();
    const from = new Date(new Date(todayStart).getTime() - (DAYS[period] - 1) * DAY_MS);
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - DAYS[period] * DAY_MS);
    const prevTo = new Date(prevFrom.getTime() + span);

    const [current, previous, daily] = await Promise.all([
      this.totals(merchantId, from, to),
      this.totals(merchantId, prevFrom, prevTo),
      this.db
        .select({
          date: sql<string>`to_char(${payments.capturedAt} at time zone 'Europe/Madrid', 'YYYY-MM-DD')`,
          volumeCents: sql<number>`coalesce(sum(${payments.amountCents} - ${payments.discountCents}), 0)::bigint`,
          payments: sql<number>`count(*)::int`,
        })
        .from(payments)
        .where(this.where(merchantId, from, to))
        .groupBy(sql`1`)
        .orderBy(sql`1`),
    ]);
    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      current,
      previous,
      daily: daily.map((d) => ({
        date: d.date,
        volumeCents: Number(d.volumeCents),
        payments: d.payments,
      })),
    };
  }

  private where(merchantId: string, from: Date, to: Date) {
    return and(
      eq(payments.merchantId, merchantId),
      eq(payments.status, 'CAPTURED'),
      gte(payments.capturedAt, from),
      lt(payments.capturedAt, to),
    );
  }

  private async totals(merchantId: string, from: Date, to: Date): Promise<AnalyticsTotals> {
    const [r] = await this.db
      .select({
        volume: sql<number>`coalesce(sum(${payments.amountCents} - ${payments.discountCents}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
        tips: sql<number>`coalesce(sum(${payments.tipCents}), 0)::bigint`,
        discounts: sql<number>`coalesce(sum(${payments.discountCents}), 0)::bigint`,
        identified: sql<number>`count(distinct ${payments.userId})::int`,
      })
      .from(payments)
      .where(this.where(merchantId, from, to));
    const volumeCents = Number(r?.volume ?? 0);
    const count = r?.count ?? 0;
    return {
      volumeCents,
      payments: count,
      avgTicketCents: count ? Math.round(volumeCents / count) : 0,
      tipsCents: Number(r?.tips ?? 0),
      discountsCents: Number(r?.discounts ?? 0),
      identifiedCustomers: r?.identified ?? 0,
    };
  }
}
