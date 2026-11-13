// Datos de comercio, local y mesa que merchant-venues da a otros servicios (VenuesDirectory en
// proceso; /v1/internal/venues/* por HTTP, MIGRACION §3.3).
import type { MerchantStatus } from '@comercechat/shared-types';

export interface TipConfig {
  enabled: boolean;
  /** Porcentajes sugeridos (FR-PAY-03, FR-MER-06). */
  percentages: number[];
}

export interface MerchantInfo {
  id: string;
  brandName: string;
  logoUrl: string | null;
  status: MerchantStatus;
  pspAccountId: string | null;
}

export interface LocationInfo {
  id: string;
  merchantId: string;
  name: string;
  address: string;
  tipConfig: TipConfig;
}

export interface TableInfo {
  id: string;
  locationId: string;
  label: string;
  /** Id de la mesa en el software de caja; `null` si aún no está enlazada (FR-POS-05). */
  externalTableId: string | null;
}

/** Una mesa con su local y su comercio. */
export interface TablePlace {
  merchant: MerchantInfo;
  location: LocationInfo;
  table: TableInfo;
}
