import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { DynamicQrResolution, DynamicQrView } from '@comercechat/shared-types';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { AuditEmitter } from '../../outbox/audit-emitter.js';
import type { MerchantPrincipal } from '../../identity/public/session.js';
import { AppError } from '../../common/app-error.js';
import { newId, randomBase62 } from '../../common/ids.js';
import { ENV, type Env, webQrBaseUrl } from '../../config/env.js';
import { DB, type Database } from '../../db/client.js';
import { VenuesDirectory } from '../../merchant-venues/public/venues-directory.js';
import { payments } from '../schema/payments.js';
import { paymentQrCodes } from '../schema/payment-qr.js';
import { RealtimeService } from '../../realtime/public/realtime.js';
import { DynamicQrKeys, signDynamicQr, verifyDynamicQr } from './dynamic-qr-token.js';

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

type QrRow = typeof paymentQrCodes.$inferSelect;
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
    private readonly audit: AuditEmitter,
    private readonly realtime: RealtimeService,
    private readonly venues: VenuesDirectory,
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
        .update(paymentQrCodes)
        .set({ status: 'REVOKED' })
        .where(and(eq(paymentQrCodes.tableId, table.id), eq(paymentQrCodes.status, 'ACTIVE')));
      const [row] = await tx
        .insert(paymentQrCodes)
        .values({
          id,
          locationId: table.locationId,
          tableId: table.id,
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
          merchantId: p.merchantId,
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
      .from(paymentQrCodes)
      .where(
        and(
          inArray(paymentQrCodes.tableId, tableIds),
          inArray(paymentQrCodes.status, ['ACTIVE', 'CONSUMED']),
          gt(paymentQrCodes.createdAt, new Date(Date.now() - SHOW_RECENT_MS)),
        ),
      )
      .orderBy(desc(paymentQrCodes.createdAt));
    for (const qr of rows) {
      if (!qr.tableId || result.has(qr.tableId)) continue;
      result.set(qr.tableId, this.toView(qr, await this.latestPayment(qr.id)));
    }
    return result;
  }

  async revoke(p: MerchantPrincipal, qrId: string): Promise<void> {
    const qr = await this.ownQr(p, qrId);
    await this.db
      .update(paymentQrCodes)
      .set({ status: 'REVOKED' })
      .where(and(eq(paymentQrCodes.id, qrId), eq(paymentQrCodes.status, 'ACTIVE')));
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
    const qr = await this.db.query.paymentQrCodes.findFirst({
      where: eq(paymentQrCodes.id, payload.qrId),
    });
    if (
      !qr ||
      qr.status !== 'ACTIVE' ||
      qr.nonce !== payload.nonce ||
      qr.amountCents !== payload.amountCents ||
      qr.locationId !== payload.locationId ||
      qr.tableId !== payload.tableId
    ) {
      throw invalid();
    }
    const row = await this.venues.tablePlace(payload.tableId);
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
    const [qr] = await this.db.select().from(paymentQrCodes).where(eq(paymentQrCodes.id, qrId));
    const location = qr ? await this.venues.location(qr.locationId) : null;
    if (!qr || location?.merchantId !== p.merchantId) {
      throw new AppError('QR_NOT_FOUND', HttpStatus.NOT_FOUND, 'QR no encontrado');
    }
    return qr;
  }

  private toView(qr: QrRow, payment: PaymentRow | null): DynamicQrView {
    const expired = qr.status === 'ACTIVE' && qr.expiresAt.getTime() <= Date.now();
    const token = signDynamicQr(this.keys, {
      qrId: qr.id,
      locationId: qr.locationId,
      tableId: qr.tableId,
      amountCents: qr.amountCents,
      exp: Math.floor(qr.expiresAt.getTime() / 1000),
      nonce: qr.nonce,
    });
    return {
      id: qr.id,
      locationId: qr.locationId,
      tableId: qr.tableId,
      amountCents: qr.amountCents,
      status: expired ? 'EXPIRED' : qr.status,
      url: `${webQrBaseUrl(this.env).replace(/\/$/, '')}/d/${token}`,
      expiresAt: qr.expiresAt.toISOString(),
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
