/** Cuenta abierta en el software de caja (TPV) del restaurante. */
export interface PosBill {
  externalBillId: string;
  lines: { externalLineId: string; name: string; qty: number; unitPriceCents: number }[];
  totalCents: number;
  /** Lo ya cobrado según el propio TPV (por ComerceChat o por otros medios). */
  paidCents: number;
}

export interface PosPaymentInput {
  amountCents: number;
  tipCents: number;
  /** Parte cubierta con un cupón del comercio: no la paga el comensal. */
  discountCents: number;
  /** Id del pago de ComerceChat. Registrar dos veces la misma referencia no duplica el cobro. */
  reference: string;
}

/**
 * Abstracción del software de caja (ARCHITECTURE §6.2). Hay un adaptador por fabricante (D-02);
 * en la PoC, `FakePosConnector`. Las mesas se identifican por `tables.external_table_id`.
 */
export interface PosConnector {
  getOpenBill(locationId: string, externalTableId: string): Promise<PosBill | null>;
  registerPayment(
    locationId: string,
    externalTableId: string,
    payment: PosPaymentInput,
  ): Promise<{ billClosed: boolean }>;
  health(locationId: string): Promise<'ok' | 'degraded' | 'down'>;
}

export const POS_CONNECTOR = Symbol('POS_CONNECTOR');

/** El TPV no responde: la web QR debe pedir al comensal que avise al personal (FR-POS-06). */
export class PosUnavailableError extends Error {
  constructor(locationId: string) {
    super(`Software de caja no disponible (local ${locationId})`);
  }
}
