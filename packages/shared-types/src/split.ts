// Reparto de la cuenta (FR-PAY-02). Funciones puras compartidas por la API y la web QR para que el
// importe que ve el comensal sea exactamente el que se cobra.

export type SplitRequest =
  | { mode: 'FULL' }
  | { mode: 'EQUAL'; parts: number; shares: number }
  | { mode: 'ITEMS'; items: { lineId: string; units: number }[] }
  | { mode: 'AMOUNT'; amountCents: number };

export type TipRequest = { kind: 'percent'; value: number } | { kind: 'amount'; cents: number };

export const MAX_SPLIT_PARTS = 20;

/**
 * Importe de `shares` partes de `parts` sobre el total de la cuenta. Se redondea hacia arriba para
 * que la suma de todas las partes cubra el total; quien paga la última parte paga solo lo que queda.
 */
export function equalShareCents(totalCents: number, parts: number, shares: number): number {
  return Math.ceil((totalCents * shares) / parts);
}

/** Propina en céntimos sobre el importe que paga cada comensal (FR-PAY-03). */
export function tipFromRequest(amountCents: number, tip: TipRequest): number {
  if (tip.kind === 'amount') return Math.max(0, Math.round(tip.cents));
  return tip.value > 0 ? Math.round((amountCents * tip.value) / 100) : 0;
}
