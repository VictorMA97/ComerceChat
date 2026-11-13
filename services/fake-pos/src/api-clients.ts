import { Inject, Injectable } from '@nestjs/common';
import type { LocationInfo, TableInfo, TablePlace } from '@comercechat/contracts';
import type { DynamicQrView } from '@comercechat/shared-types';
import { AppError, InternalHttpClient } from '@comercechat/service-kit';
import { ENV, type Env } from './config/env.js';

/** Cliente de las rutas /v1/internal/* de la API que necesita el simulador. */
export const API_CLIENT = Symbol('API_CLIENT');

export const apiClientProvider = {
  provide: API_CLIENT,
  inject: [ENV],
  useFactory: (env: Env) =>
    new InternalHttpClient('api', env.API_INTERNAL_URL, env.INTERNAL_SERVICE_SECRET),
};

const notFoundAsNull = (err: unknown) => {
  if (err instanceof AppError && err.getStatus() === 404) return null;
  throw err;
};

/** Locales y mesas del comercio (merchant-venues, /v1/internal/venues/*). */
@Injectable()
export class VenuesClient {
  constructor(@Inject(API_CLIENT) private readonly api: InternalHttpClient) {}

  locationsOf(merchantId: string): Promise<LocationInfo[]> {
    return this.api.get(`/v1/internal/venues/merchants/${merchantId}/locations`);
  }

  location(locationId: string): Promise<LocationInfo | null> {
    return this.api
      .get<LocationInfo>(`/v1/internal/venues/locations/${locationId}`)
      .catch(notFoundAsNull);
  }

  tablesOf(locationId: string): Promise<TableInfo[]> {
    return this.api.get(`/v1/internal/venues/locations/${locationId}/tables`);
  }

  tablePlace(tableId: string): Promise<TablePlace | null> {
    return this.api
      .get<TablePlace>(`/v1/internal/venues/tables/${tableId}/place`)
      .catch(notFoundAsNull);
  }
}

/** QR de cobro de las mesas (table-payments, /v1/internal/payments/*). */
@Injectable()
export class PaymentsClient {
  constructor(@Inject(API_CLIENT) private readonly api: InternalHttpClient) {}

  async paymentQrsForTables(tableIds: string[]): Promise<Map<string, DynamicQrView>> {
    if (tableIds.length === 0) return new Map();
    const byTable = await this.api.post<Record<string, DynamicQrView>>(
      '/v1/internal/payments/payment-qrs',
      { tableIds },
    );
    return new Map(Object.entries(byTable));
  }
}
