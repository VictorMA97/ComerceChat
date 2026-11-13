import { Inject, Injectable } from '@nestjs/common';
import type { QrResolution } from '@comercechat/shared-types';
import type {
  LocationInfo,
  MerchantInfo,
  TableInfo,
  TablePlace,
  TipConfig,
} from '@comercechat/contracts';
import { asc, eq, inArray } from 'drizzle-orm';
import { DB, type Database } from '../../db/client.js';
import { QrService } from '../qr/qr.service.js';
import { merchantLocations, merchants, tables } from '../schema/merchants.js';

// Los tipos viven en @comercechat/contracts: los usan también los servicios que llaman por HTTP.
export type { LocationInfo, MerchantInfo, TableInfo, TablePlace, TipConfig };

/**
 * API pública de merchant-venues para el resto de contextos (ADR-029): comercios, locales, mesas y
 * resolución de QR estáticos. Devuelve datos planos, nunca filas ni tablas. Con servicios separados
 * será `GET /internal/...` de merchant-venues (MIGRACION §3.3).
 */
@Injectable()
export class VenuesDirectory {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly qr: QrService,
  ) {}

  /** QR estático de mesa con la identidad verificada del comercio (cache de 30 s, ADR-025). */
  resolveQr(shortCode: string): Promise<QrResolution> {
    return this.qr.resolve(shortCode);
  }

  async merchant(merchantId: string): Promise<MerchantInfo | null> {
    const [m] = await this.db
      .select(merchantColumns)
      .from(merchants)
      .where(eq(merchants.id, merchantId));
    return m ?? null;
  }

  /** Nombre comercial de cada comercio pedido (los que no existen no aparecen). */
  async merchantNames(merchantIds: Iterable<string>): Promise<Map<string, string>> {
    const ids = [...new Set(merchantIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: merchants.id, brandName: merchants.brandName })
      .from(merchants)
      .where(inArray(merchants.id, ids));
    return new Map(rows.map((r) => [r.id, r.brandName]));
  }

  async location(locationId: string): Promise<LocationInfo | null> {
    const [l] = await this.db
      .select(locationColumns)
      .from(merchantLocations)
      .where(eq(merchantLocations.id, locationId));
    return l ?? null;
  }

  /** Locales de un comercio, por nombre. */
  locationsOf(merchantId: string): Promise<LocationInfo[]> {
    return this.db
      .select(locationColumns)
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, merchantId))
      .orderBy(asc(merchantLocations.name));
  }

  tablesOf(locationId: string): Promise<TableInfo[]> {
    return this.db.select(tableColumns).from(tables).where(eq(tables.locationId, locationId));
  }

  async tablePlace(tableId: string): Promise<TablePlace | null> {
    const [row] = await this.db
      .select({ table: tableColumns, location: locationColumns, merchant: merchantColumns })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .innerJoin(merchants, eq(merchants.id, merchantLocations.merchantId))
      .where(eq(tables.id, tableId));
    return row ?? null;
  }
}

const merchantColumns = {
  id: merchants.id,
  brandName: merchants.brandName,
  logoUrl: merchants.logoUrl,
  status: merchants.status,
  pspAccountId: merchants.pspAccountId,
};
const locationColumns = {
  id: merchantLocations.id,
  merchantId: merchantLocations.merchantId,
  name: merchantLocations.name,
  address: merchantLocations.address,
  tipConfig: merchantLocations.tipConfig,
};
const tableColumns = {
  id: tables.id,
  locationId: tables.locationId,
  label: tables.label,
  externalTableId: tables.externalTableId,
};
