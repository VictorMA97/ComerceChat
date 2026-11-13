import {
  AppError,
  type InternalHttpClient,
  ServiceUnavailableError,
} from '@comercechat/service-kit';
import {
  type PosBill,
  type PosConnector,
  type PosPaymentInput,
  PosUnavailableError,
} from './pos-connector.js';

/**
 * Adaptador del software de caja simulado, que desde MS F3 es otro servicio (services/fake-pos): la
 * misma interfaz que tendrá el adaptador de un TPV real (D-02). Si la caja está «caída» en el
 * simulador o el simulador no responde, `PosUnavailableError` (FR-POS-06).
 */
export class FakePosHttpConnector implements PosConnector {
  constructor(private readonly pos: InternalHttpClient) {}

  async getOpenBill(locationId: string, externalTableId: string): Promise<PosBill | null> {
    const { bill } = await this.call(locationId, () =>
      this.pos.get<{ bill: PosBill | null }>(`${this.table(locationId, externalTableId)}/bill`),
    );
    return bill;
  }

  registerPayment(
    locationId: string,
    externalTableId: string,
    payment: PosPaymentInput,
  ): Promise<{ billClosed: boolean }> {
    return this.call(locationId, () =>
      this.pos.post<{ billClosed: boolean }>(
        `${this.table(locationId, externalTableId)}/payments`,
        payment,
      ),
    );
  }

  async health(locationId: string): Promise<'ok' | 'degraded' | 'down'> {
    try {
      const { status } = await this.pos.get<{ status: 'ok' | 'down' }>(
        `/v1/internal/pos/locations/${encodeURIComponent(locationId)}/health`,
      );
      return status;
    } catch (err) {
      if (err instanceof ServiceUnavailableError) return 'down';
      throw err;
    }
  }

  async linkNewTables(
    locationId: string,
    tables: { id: string; label: string }[],
  ): Promise<Map<string, string>> {
    const { links } = await this.pos.post<{ links: Record<string, string> }>(
      `/v1/internal/pos/locations/${encodeURIComponent(locationId)}/tables`,
      { tables },
    );
    return new Map(Object.entries(links));
  }

  private table(locationId: string, externalTableId: string): string {
    return `/v1/internal/pos/locations/${encodeURIComponent(locationId)}/tables/${encodeURIComponent(externalTableId)}`;
  }

  private async call<T>(locationId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof ServiceUnavailableError ||
        (err instanceof AppError && err.code === 'POS_UNAVAILABLE')
      ) {
        throw new PosUnavailableError(locationId);
      }
      throw err;
    }
  }
}
