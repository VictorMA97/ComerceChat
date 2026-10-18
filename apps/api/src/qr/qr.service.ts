import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { QrResolution, TableQr } from '@comercechat/shared-types';
import { and, eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { newId } from '../common/ids.js';
import { ENV, type Env, webQrBaseUrl } from '../config/env.js';
import { DB, type Database, type Tx } from '../db/client.js';
import { merchantLocations, merchants, qrCodes, tables } from '../db/schema/index.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { REDIS } from '../redis/redis.module.js';
import { generateShortCode, qrUrl, signQr, verifyQrSignature } from './qr-signature.js';

/** TTL de la cache de resolución. Garantiza que un QR revocado deja de funcionar en < 60 s (FR-QR-05). */
const RESOLVE_CACHE_TTL_SECONDS = 30;
const cacheKey = (shortCode: string) => `qr:resolve:${shortCode}`;
const INVALID = 'INVALID';

const qrInvalid = () =>
  new AppError(
    'QR_INVALID',
    HttpStatus.NOT_FOUND,
    'Este código QR no es válido o ha sido retirado',
  );

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Emite un QR estático de mesa (FR-QR-01). Debe llamarse dentro de una transacción. */
  async issueTableQr(
    tx: Tx,
    input: { locationId: string; tableId: string; version?: number; createdBy?: string },
  ) {
    const id = newId();
    const version = input.version ?? 1;
    const signature = signQr(this.env.QR_HMAC_SECRET, {
      id,
      locationId: input.locationId,
      tableId: input.tableId,
      version,
    });
    const [qr] = await tx
      .insert(qrCodes)
      .values({
        id,
        type: 'STATIC_TABLE',
        locationId: input.locationId,
        tableId: input.tableId,
        shortCode: generateShortCode(),
        signature,
        version,
        createdBy: input.createdBy,
      })
      .returning();
    return qr!;
  }

  /** Revoca el QR activo de la mesa y emite uno nuevo (FR-QR-05). Solo OWNER y MANAGER. */
  async regenerateTableQr(
    principal: MerchantPrincipal,
    tableId: string,
    ip?: string,
  ): Promise<TableQr> {
    const { revokedCode, qr } = await this.db.transaction(async (tx) => {
      const [table] = await tx
        .select({ id: tables.id, locationId: tables.locationId })
        .from(tables)
        .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
        .where(and(eq(tables.id, tableId), eq(merchantLocations.merchantId, principal.merchantId)));
      if (!table) throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');

      const [revoked] = await tx
        .update(qrCodes)
        .set({ status: 'REVOKED' })
        .where(
          and(
            eq(qrCodes.tableId, tableId),
            eq(qrCodes.type, 'STATIC_TABLE'),
            eq(qrCodes.status, 'ACTIVE'),
          ),
        )
        .returning({ id: qrCodes.id, shortCode: qrCodes.shortCode, version: qrCodes.version });

      const qr = await this.issueTableQr(tx, {
        locationId: table.locationId,
        tableId,
        version: (revoked?.version ?? 0) + 1,
        createdBy: principal.merchantUserId,
      });

      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: principal.merchantUserId,
          action: 'qr.regenerated',
          entity: 'table',
          entityId: tableId,
          before: revoked ? { qrId: revoked.id, shortCode: revoked.shortCode } : null,
          after: { qrId: qr.id, shortCode: qr.shortCode },
          ip,
        },
        tx,
      );
      if (revoked) {
        await this.outbox.enqueue(tx, {
          aggregate: 'qr_code',
          aggregateId: revoked.id,
          type: 'QrRevoked',
          payload: { qrId: revoked.id, tableId, replacedBy: qr.id },
        });
      }
      return { revokedCode: revoked?.shortCode, qr };
    });

    if (revokedCode) await this.redis.del(cacheKey(revokedCode));
    return this.toTableQr(qr);
  }

  /** Resuelve un QR público y devuelve la identidad verificada del comercio (FR-QR-01, FR-QR-04). */
  async resolve(shortCode: string): Promise<QrResolution> {
    const cached = await this.redis.get(cacheKey(shortCode)).catch(() => null);
    if (cached === INVALID) throw qrInvalid();
    if (cached) return JSON.parse(cached) as QrResolution;

    const resolution = await this.resolveFromDb(shortCode);
    await this.redis
      .set(
        cacheKey(shortCode),
        resolution ? JSON.stringify(resolution) : INVALID,
        'EX',
        RESOLVE_CACHE_TTL_SECONDS,
      )
      .catch((err: unknown) => this.logger.warn(`No se pudo cachear el QR: ${String(err)}`));
    if (!resolution) throw qrInvalid();
    return resolution;
  }

  private async resolveFromDb(shortCode: string): Promise<QrResolution | null> {
    const row = await this.db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, shortCode),
      with: { location: true, table: true },
    });
    if (!row || row.status !== 'ACTIVE') return null;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
    const signatureOk = verifyQrSignature(
      this.env.QR_HMAC_SECRET,
      { id: row.id, locationId: row.locationId, tableId: row.tableId, version: row.version },
      row.signature,
    );
    if (!signatureOk) {
      this.logger.error(`Firma de QR inválida (posible manipulación de BD): qr=${row.id}`);
      return null;
    }
    const merchant = await this.db.query.merchants.findFirst({
      where: eq(merchants.id, row.location.merchantId),
    });
    if (!merchant || merchant.status !== 'ACTIVE') {
      throw new AppError(
        'MERCHANT_UNAVAILABLE',
        HttpStatus.CONFLICT,
        'Este comercio no acepta pagos por QR ahora',
      );
    }
    return {
      shortCode: row.shortCode,
      type: row.type,
      merchant: { id: merchant.id, brandName: merchant.brandName, logoUrl: merchant.logoUrl },
      location: { id: row.location.id, name: row.location.name, address: row.location.address },
      table: row.table ? { id: row.table.id, label: row.table.label } : null,
    };
  }

  toTableQr(qr: typeof qrCodes.$inferSelect): TableQr {
    return {
      id: qr.id,
      shortCode: qr.shortCode,
      type: qr.type,
      status: qr.status,
      url: qrUrl(webQrBaseUrl(this.env), qr.shortCode),
    };
  }
}
