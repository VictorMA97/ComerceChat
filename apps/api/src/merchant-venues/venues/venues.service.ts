import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type MerchantPrincipal } from '@comercechat/auth-client';
import type { LocationView } from '@comercechat/shared-types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AuditEmitter, AppError } from '@comercechat/service-kit';
import { DB, type Database, type Tx } from '../../db/client.js';
import { merchantLocations, tables } from '../schema/merchants.js';
import { qrCodes } from '../schema/qr.js';
import { POS_CONNECTOR, type PosConnector } from '@comercechat/pos-connectors';
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
    private readonly audit: AuditEmitter,
  ) {}

  /** Alta de un local (FR-MER-03) y, opcionalmente, de sus primeras mesas con QR. */
  async createLocation(
    principal: MerchantPrincipal,
    input: NewLocation & { tableCount?: number; capacity?: number },
    ip?: string,
  ): Promise<{ id: string }> {
    const { id, created } = await this.db.transaction(async (tx) => {
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
      const created = input.tableCount
        ? await this.insertTables(tx, principal, location!.id, input.tableCount, input.capacity, ip)
        : [];
      return { id: location!.id, created };
    });
    await this.linkToPos(id, created);
    return { id };
  }

  /** Alta masiva de mesas (FR-MER-04): numera a continuación de las existentes y emite su QR. */
  async addTables(
    principal: MerchantPrincipal,
    locationId: string,
    count: number,
    capacity?: number,
    ip?: string,
  ): Promise<void> {
    const created = await this.db.transaction(async (tx) => {
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
      return this.insertTables(tx, principal, locationId, count, capacity, ip);
    });
    await this.linkToPos(locationId, created);
  }

  /**
   * Enlaza las mesas nuevas con el software de caja (FR-POS-05). Va después del commit: la caja es
   * otro sistema (ADR-029). Si falla, las mesas quedan sin enlazar y la web QR pide la cuenta al
   * personal (TABLE_NOT_LINKED) hasta que se emparejen.
   */
  private async linkToPos(
    locationId: string,
    created: { id: string; label: string }[],
  ): Promise<void> {
    if (created.length === 0 || !this.pos.linkNewTables) return;
    const links = await this.pos.linkNewTables(locationId, created);
    for (const [tableId, externalTableId] of links) {
      await this.db.update(tables).set({ externalTableId }).where(eq(tables.id, tableId));
    }
  }

  private async insertTables(
    tx: Tx,
    principal: MerchantPrincipal,
    locationId: string,
    count: number,
    capacity = 4,
    ip?: string,
  ): Promise<{ id: string; label: string }[]> {
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

    for (const t of rows) {
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
    return rows;
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
