import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { DynamicQrResolution, DynamicQrView } from '@comercechat/shared-types';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { newId, randomBase62 } from '../common/ids.js';
import { ENV, type Env, webQrBaseUrl } from '../config/env.js';
import { DB, type Database } from '../db/client.js';
import { merchantLocations, merchants, payments, qrCodes, tables } from '../db/schema/index.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { DynamicQrKeys, signDynamicQr, verifyDynamicQr } from './dynamic-qr-token.js';
import { generateShortCode, signQr } from './qr-signature.js';

/** El simulador sigue mostrando el QR de cobro de una mesa durante este tiempo tras crearlo. */
const SHOW_RECENT_MS = 30 * 60 * 1000;

export interface DynamicQrContext {
  qrId: string;
  merchantId: string;
  locationId: string;
  tableId: string;
  amountCents: number;
  expiresAt: Date;
  resolution: DynamicQrResolution;
}

type QrRow = typeof qrCodes.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

const invalid = () =>
  new AppError('QR_INVALID', HttpStatus.NOT_FOUND, 'Este código QR no es válido o ha caducado');

/**
 * QR de cobro de un solo uso que el personal genera desde la caja para una mesa (FR-QR-03): lleva
 * firmado el importe pendiente en ese momento y su pago se registra en la cuenta de la mesa.
 */
@Injectable()
export class DynamicQrService {
  private readonly keys: DynamicQrKeys;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {
    this.keys = new DynamicQrKeys(env.QR_SIGNING_KEY);
  }

  /**
   * Crea el QR de cobro de una mesa por `amountCents` y anula el anterior si seguía activo. El
   * llamante calcula el importe (lo que queda por pagar) y comprueba que la mesa es del comercio.
   */
  async createForTable(
    p: MerchantPrincipal,
    table: { id: string; locationId: string },
    amountCents: number,
  ): Promise<DynamicQrView> {
    const id = newId();
    const expiresAt = new Date(
      Math.ceil((Date.now() + this.env.DYNAMIC_QR_TTL_SECONDS * 1000) / 1000) * 1000,
    );
    const qr = await this.db.transaction(async (tx) => {
      await tx
        .update(qrCodes)
        .set({ status: 'REVOKED' })
        .where(
          and(
            eq(qrCodes.tableId, table.id),
            eq(qrCodes.type, 'DYNAMIC_AMOUNT'),
            eq(qrCodes.status, 'ACTIVE'),
          ),
        );
      const [row] = await tx
        .insert(qrCodes)
        .values({
          id,
          type: 'DYNAMIC_AMOUNT',
          locationId: table.locationId,
          tableId: table.id,
          shortCode: generateShortCode(),
          signature: signQr(this.env.QR_HMAC_SECRET, {
            id,
            locationId: table.locationId,
            tableId: table.id,
            version: 1,
          }),
          amountCents,
          nonce: randomBase62(16),
          expiresAt,
          createdBy: p.merchantUserId,
        })
        .returning();
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: p.merchantUserId,
          action: 'qr.payment_qr_created',
          entity: 'qr_code',
          entityId: id,
          after: { tableId: table.id, amountCents },
        },
        tx,
      );
      return row!;
    });
    await this.realtime.publish({
      type: 'table.updated',
      locationId: table.locationId,
      tableId: table.id,
      qrId: id,
      reason: 'payment_qr.created',
    });
    return this.toView(qr, null);
  }

  async get(p: MerchantPrincipal, qrId: string): Promise<DynamicQrView> {
    const qr = await this.ownQr(p, qrId);
    return this.toView(qr, await this.latestPayment(qr.id));
  }

  /** Último QR de cobro de cada mesa (activo o cobrado en los últimos 30 min), para el simulador. */
  async latestForTables(tableIds: string[]): Promise<Map<string, DynamicQrView>> {
    const result = new Map<string, DynamicQrView>();
    if (tableIds.length === 0) return result;
    const rows = await this.db
      .select()
      .from(qrCodes)
      .where(
        and(
          inArray(qrCodes.tableId, tableIds),
          eq(qrCodes.type, 'DYNAMIC_AMOUNT'),
          inArray(qrCodes.status, ['ACTIVE', 'CONSUMED']),
          gt(qrCodes.createdAt, new Date(Date.now() - SHOW_RECENT_MS)),
        ),
      )
      .orderBy(desc(qrCodes.createdAt));
    for (const qr of rows) {
      if (!qr.tableId || result.has(qr.tableId)) continue;
      result.set(qr.tableId, this.toView(qr, await this.latestPayment(qr.id)));
    }
    return result;
  }

  async revoke(p: MerchantPrincipal, qrId: string): Promise<void> {
    const qr = await this.ownQr(p, qrId);
    await this.db
      .update(qrCodes)
      .set({ status: 'REVOKED' })
      .where(and(eq(qrCodes.id, qrId), eq(qrCodes.status, 'ACTIVE')));
    await this.realtime.publish({
      type: 'table.updated',
      locationId: qr.locationId,
      tableId: qr.tableId ?? undefined,
      qrId,
      reason: 'payment_qr.revoked',
    });
  }

  /** Verifica el token escaneado: firma, caducidad, estado, nonce y mesa. */
  async resolve(token: string): Promise<DynamicQrContext> {
    const payload = verifyDynamicQr(this.keys, token);
    if (!payload || payload.exp * 1000 <= Date.now()) throw invalid();
    const qr = await this.db.query.qrCodes.findFirst({ where: eq(qrCodes.id, payload.qrId) });
    if (
      !qr ||
      qr.type !== 'DYNAMIC_AMOUNT' ||
      qr.status !== 'ACTIVE' ||
      qr.nonce !== payload.nonce ||
      qr.amountCents !== payload.amountCents ||
      qr.locationId !== payload.locationId ||
      qr.tableId !== payload.tableId
    ) {
      throw invalid();
    }
    const [row] = await this.db
      .select({ table: tables, location: merchantLocations, merchant: merchants })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .innerJoin(merchants, eq(merchants.id, merchantLocations.merchantId))
      .where(eq(tables.id, payload.tableId));
    if (!row || row.merchant.status !== 'ACTIVE') {
      throw new AppError(
        'MERCHANT_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'Este comercio no acepta pagos por QR ahora',
      );
    }
    return {
      qrId: qr.id,
      merchantId: row.merchant.id,
      locationId: row.location.id,
      tableId: row.table.id,
      amountCents: payload.amountCents,
      expiresAt: new Date(payload.exp * 1000),
      resolution: {
        qrId: qr.id,
        merchant: {
          id: row.merchant.id,
          brandName: row.merchant.brandName,
          logoUrl: row.merchant.logoUrl,
        },
        location: { id: row.location.id, name: row.location.name, address: row.location.address },
        table: { id: row.table.id, label: row.table.label },
        amountCents: payload.amountCents,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        tips: row.location.tipConfig,
      },
    };
  }

  private async latestPayment(qrId: string): Promise<PaymentRow | null> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.qrCodeId, qrId))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return payment ?? null;
  }

  private async ownQr(p: MerchantPrincipal, qrId: string): Promise<QrRow> {
    const [row] = await this.db
      .select({ qr: qrCodes })
      .from(qrCodes)
      .innerJoin(merchantLocations, eq(merchantLocations.id, qrCodes.locationId))
      .where(
        and(
          eq(qrCodes.id, qrId),
          eq(qrCodes.type, 'DYNAMIC_AMOUNT'),
          eq(merchantLocations.merchantId, p.merchantId),
        ),
      );
    if (!row) throw new AppError('QR_NOT_FOUND', HttpStatus.NOT_FOUND, 'QR no encontrado');
    return row.qr;
  }

  private toView(qr: QrRow, payment: PaymentRow | null): DynamicQrView {
    const expired =
      qr.status === 'ACTIVE' && qr.expiresAt !== null && qr.expiresAt.getTime() <= Date.now();
    const token = signDynamicQr(this.keys, {
      qrId: qr.id,
      locationId: qr.locationId,
      tableId: qr.tableId ?? '',
      amountCents: qr.amountCents ?? 0,
      exp: Math.floor((qr.expiresAt?.getTime() ?? 0) / 1000),
      nonce: qr.nonce ?? '',
    });
    return {
      id: qr.id,
      locationId: qr.locationId,
      tableId: qr.tableId ?? '',
      amountCents: qr.amountCents ?? 0,
      status: expired ? 'EXPIRED' : qr.status,
      url: `${webQrBaseUrl(this.env).replace(/\/$/, '')}/d/${token}`,
      expiresAt: qr.expiresAt!.toISOString(),
      payment: payment
        ? {
            status: payment.status,
            tipCents: payment.tipCents,
            capturedAt: payment.capturedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
