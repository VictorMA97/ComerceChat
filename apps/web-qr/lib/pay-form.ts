import {
  equalShareCents,
  type SplitRequest,
  tipFromRequest,
  type TipRequest,
} from '@comercechat/shared-types';

/** Lectura de los campos del formulario de pago. La comparten el cliente (vista previa) y la server action. */
export interface BillForSplit {
  totalCents: number;
  availableCents: number;
  lines: { lineId: string; unitPriceCents: number }[];
}

const euros = (v: FormDataEntryValue | null) => {
  const n = Number(
    String(v ?? '')
      .replace(',', '.')
      .trim() || 0,
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

export function readSplit(form: FormData): SplitRequest {
  switch (String(form.get('split') ?? 'FULL')) {
    case 'EQUAL':
      return {
        mode: 'EQUAL',
        parts: Number(form.get('parts') ?? 2),
        shares: Number(form.get('shares') ?? 1),
      };
    case 'ITEMS': {
      const items: { lineId: string; units: number }[] = [];
      for (const [key, value] of form.entries()) {
        if (!key.startsWith('units:')) continue;
        const units = Number(value);
        if (Number.isInteger(units) && units > 0) items.push({ lineId: key.slice(6), units });
      }
      return { mode: 'ITEMS', items };
    }
    case 'AMOUNT':
      return { mode: 'AMOUNT', amountCents: euros(form.get('amount')) };
    default:
      return { mode: 'FULL' };
  }
}

export function readTip(form: FormData): TipRequest {
  const choice = String(form.get('tip') ?? 'pct:0');
  if (choice === 'custom') return { kind: 'amount', cents: euros(form.get('tipCustom')) };
  const pct = Number(choice.startsWith('pct:') ? choice.slice(4) : 0);
  return { kind: 'percent', value: Number.isFinite(pct) ? pct : 0 };
}

/** Importe que pagará este comensal según el reparto (igual que lo calcula la API). */
export function previewAmount(split: SplitRequest, bill: BillForSplit): number {
  switch (split.mode) {
    case 'FULL':
      return bill.availableCents;
    case 'EQUAL':
      return Math.min(
        bill.availableCents,
        equalShareCents(bill.totalCents, split.parts, split.shares),
      );
    case 'AMOUNT':
      return split.amountCents;
    case 'ITEMS':
      return split.items.reduce(
        (sum, i) =>
          sum + i.units * (bill.lines.find((l) => l.lineId === i.lineId)?.unitPriceCents ?? 0),
        0,
      );
  }
}

export const previewTip = (amountCents: number, tip: TipRequest) =>
  tipFromRequest(amountCents, tip);

export const readCouponId = (form: FormData): string | undefined => {
  const v = String(form.get('couponId') ?? '');
  return v ? v : undefined;
};

/** Descuento del cupón (igual que la API): 0 si no llega al gasto mínimo. */
export function previewDiscount(
  amountCents: number,
  coupon: { discountCents: number; minSpendCents: number } | undefined,
): number {
  if (!coupon || amountCents < coupon.minSpendCents) return 0;
  return Math.min(coupon.discountCents, amountCents);
}
