import { Inject, Injectable } from '@nestjs/common';
import type { LocationView } from '@comercechat/shared-types';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { merchantLocations, qrCodes, tables } from '../db/schema/index.js';
import { QrService } from '../qr/qr.service.js';

@Injectable()
export class VenuesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly qr: QrService,
  ) {}

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
