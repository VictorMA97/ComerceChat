import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { LocationView } from '@comercechat/shared-types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { AppError } from '../common/app-error.js';
import { DB, type Database, type Tx } from '../db/client.js';
import { merchantLocations, qrCodes, tables } from '../db/schema/index.js';
import { POS_CONNECTOR, type PosConnector } from '../pos/pos-connector.js';
import { QrService } from '../qr/qr.service.js';

export interface NewLocation {
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
}

@Injectable()
export class VenuesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(POS_CONNECTOR) private readonly pos: PosConnector,
    private readonly qr: QrService,
    private readonly audit: AuditService,
  ) {}

  /** Alta de un local (FR-MER-03) y, opcionalmente, de sus primeras mesas con QR. */
  async createLocation(
    principal: MerchantPrincipal,
    input: NewLocation & { tableCount?: number; capacity?: number },
    ip?: string,
  ): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      const [location] = await tx
        .insert(merchantLocations)
        .values({
          merchantId: principal.merchantId,
          name: input.name.trim(),
          address: input.address.trim(),
          category: input.category,
          geo: { lat: input.lat, lng: input.lng },
        })
        .returning();
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: principal.merchantUserId,
          merchantId: principal.merchantId,
          action: 'location.created',
          entity: 'merchant_location',
          entityId: location!.id,
          after: { name: location!.name },
          ip,
        },
        tx,
      );
      if (input.tableCount) {
        await this.insertTables(tx, principal, location!.id, input.tableCount, input.capacity, ip);
      }
      return { id: location!.id };
    });
  }

  /** Alta masiva de mesas (FR-MER-04): numera a continuación de las existentes y emite su QR. */
  async addTables(
    principal: MerchantPrincipal,
    locationId: string,
    count: number,
    capacity?: number,
    ip?: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Bloquea el local: dos altas simultáneas no pueden repetir la misma numeración.
      const [location] = await tx
        .select({ id: merchantLocations.id })
        .from(merchantLocations)
        .where(
          and(
            eq(merchantLocations.id, locationId),
            eq(merchantLocations.merchantId, principal.merchantId),
          ),
        )
        .for('update');
      if (!location) {
        throw new AppError('LOCATION_NOT_FOUND', HttpStatus.NOT_FOUND, 'Local no encontrado');
      }
      await this.insertTables(tx, principal, locationId, count, capacity, ip);
    });
  }

  private async insertTables(
    tx: Tx,
    principal: MerchantPrincipal,
    locationId: string,
    count: number,
    capacity = 4,
    ip?: string,
  ): Promise<void> {
    const existing = await tx
      .select({ label: tables.label })
      .from(tables)
      .where(eq(tables.locationId, locationId));
    const last = Math.max(
      0,
      ...existing.map((t) => Number(/^Mesa (\d+)$/.exec(t.label)?.[1] ?? 0)),
    );
    const rows = await tx
      .insert(tables)
      .values(
        Array.from({ length: count }, (_, i) => ({
          locationId,
          label: `Mesa ${last + i + 1}`,
          capacity,
        })),
      )
      .returning({ id: tables.id, label: tables.label });

    const links = (await this.pos.linkNewTables?.(tx, locationId, rows)) ?? new Map();
    for (const t of rows) {
      const externalTableId = links.get(t.id);
      if (externalTableId) {
        await tx.update(tables).set({ externalTableId }).where(eq(tables.id, t.id));
      }
      await this.qr.issueTableQr(tx, {
        locationId,
        tableId: t.id,
        createdBy: principal.merchantUserId,
      });
    }
    await this.audit.record(
      {
        actorType: 'MERCHANT_USER',
        actorId: principal.merchantUserId,
        merchantId: principal.merchantId,
        action: 'tables.created',
        entity: 'merchant_location',
        entityId: locationId,
        after: { labels: rows.map((t) => t.label) },
        ip,
      },
      tx,
    );
  }

  /** Locales del comercio con sus mesas y el QR activo de cada mesa. */
  async listLocations(merchantId: string): Promise<LocationView[]> {
    const locations = await this.db
      .select()
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, merchantId))
      .orderBy(asc(merchantLocations.name));
    if (locations.length === 0) return [];

    const tableRows = await this.db
      .select()
      .from(tables)
      .where(
        inArray(
          tables.locationId,
          locations.map((l) => l.id),
        ),
      )
      .orderBy(asc(tables.label));

    const qrRows = tableRows.length
      ? await this.db
          .select()
          .from(qrCodes)
          .where(
            and(
              inArray(
                qrCodes.tableId,
                tableRows.map((t) => t.id),
              ),
              eq(qrCodes.type, 'STATIC_TABLE'),
              eq(qrCodes.status, 'ACTIVE'),
            ),
          )
      : [];
    const qrByTable = new Map(qrRows.map((q) => [q.tableId, q]));

    return locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      category: l.category,
      tables: tableRows
        .filter((t) => t.locationId === l.id)
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))
        .map((t) => {
          const qr = qrByTable.get(t.id);
          return {
            id: t.id,
            label: t.label,
            capacity: t.capacity,
            active: t.active,
            qr: qr ? this.qr.toTableQr(qr) : null,
          };
        }),
    }));
  }
}
