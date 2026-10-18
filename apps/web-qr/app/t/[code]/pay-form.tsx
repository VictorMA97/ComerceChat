'use client';

import type { BillLine, CouponView } from '@comercechat/shared-types';
import { useActionState, useEffect, useRef, useState } from 'react';
import { formatCents } from '@/lib/money';
import {
  previewAmount,
  previewDiscount,
  previewTip,
  readCouponId,
  readSplit,
  readTip,
} from '@/lib/pay-form';
import { type PayState, startPayment } from './actions';

interface Props {
  /** QR de mesa (con reparto) o token del QR de cobro de la caja (importe fijo). */
  target: { qrCode: string } | { dynamicToken: string };
  bill: { totalCents: number; availableCents: number; lines: BillLine[] } | null;
  fixedAmountCents?: number;
  tips: { enabled: boolean; percentages: number[] };
  guestMaxPaymentCents: number;
  /** Base de la Idempotency-Key: un doble clic con la misma elección no crea dos sesiones. */
  idempotencyBase: string;
  /** Cupones del comensal identificado en este comercio (FR-CPN-05). */
  coupons?: CouponView[];
}

const MAX_PARTS = 10;

/**
 * Formulario de pago (FR-PAY-02/03). Funciona sin JavaScript: el reparto y la propina son controles
 * nativos y la server action hace el cálculo. El JavaScript solo muestra el importe en vivo.
 */
export function PayForm({
  target,
  bill,
  fixedAmountCents,
  tips,
  guestMaxPaymentCents,
  idempotencyBase,
  coupons = [],
}: Props) {
  const [state, action, pending] = useActionState<PayState, FormData>(startPayment, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState({
    amount: fixedAmountCents ?? bill?.availableCents ?? 0,
    discount: 0,
    tip: 0,
    belowMinimum: false,
  });

  const sync = () => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const amount = fixedAmountCents ?? (bill ? previewAmount(readSplit(data), bill) : 0);
    const coupon = coupons.find((c) => c.id === readCouponId(data));
    const discount = previewDiscount(amount, coupon);
    setPreview({
      amount,
      discount,
      tip: tips.enabled ? previewTip(amount - discount, readTip(data)) : 0,
      belowMinimum: Boolean(coupon && amount < coupon.minSpendCents),
    });
  };
  // Si el comensal tocó algo antes de que cargara el JavaScript, se recoge al hidratar.
  useEffect(sync, [bill?.availableCents, fixedAmountCents]);

  const total = preview.amount - preview.discount + preview.tip;
  const overLimit = total > guestMaxPaymentCents;
  const tooMuch = bill ? preview.amount > bill.availableCents : false;
  const payable = bill?.lines.filter((l) => l.qty - l.paidUnits - l.reservedUnits > 0) ?? [];

  return (
    <form ref={formRef} action={action} onChange={sync} onInput={sync} className="pay">
      {'qrCode' in target ? (
        <input type="hidden" name="qrCode" value={target.qrCode} />
      ) : (
        <input type="hidden" name="dynamicToken" value={target.dynamicToken} />
      )}
      <input type="hidden" name="idempotencyBase" value={idempotencyBase} />

      {bill && (
        <fieldset className="split">
          <legend>¿Qué pagas?</legend>
          <div className="split-options">
            <label className="option">
              <input type="radio" name="split" value="FULL" defaultChecked />
              <span>
                Todo lo pendiente <strong>{formatCents(bill.availableCents)}</strong>
              </span>
            </label>
            <label className="option">
              <input type="radio" name="split" value="EQUAL" />
              <span>A partes iguales</span>
            </label>
            {payable.length > 0 && (
              <label className="option">
                <input type="radio" name="split" value="ITEMS" />
                <span>Solo mis platos</span>
              </label>
            )}
            <label className="option">
              <input type="radio" name="split" value="AMOUNT" />
              <span>Otro importe</span>
            </label>
          </div>

          <div className="split-panel" data-mode="EQUAL">
            <label>
              Somos
              <select name="parts" defaultValue="2">
                {Array.from({ length: MAX_PARTS - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} personas
                  </option>
                ))}
              </select>
            </label>
            <label>
              y pago
              <select name="shares" defaultValue="1">
                {Array.from({ length: MAX_PARTS - 1 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'mi parte' : `${n} partes`}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">Cada parte es el total dividido entre las personas.</p>
          </div>

          <div className="split-panel" data-mode="ITEMS">
            <ul className="pick">
              {payable.map((l) => {
                const free = l.qty - l.paidUnits - l.reservedUnits;
                return (
                  <li key={l.lineId}>
                    <label>
                      {free === 1 ? (
                        <input type="checkbox" name={`units:${l.lineId}`} value="1" />
                      ) : (
                        <input
                          type="number"
                          name={`units:${l.lineId}`}
                          min={0}
                          max={free}
                          defaultValue={0}
                          inputMode="numeric"
                          aria-label={`Unidades de ${l.name}`}
                        />
                      )}
                      <span className="name">
                        {l.name}
                        {free < l.qty && <small> (quedan {free})</small>}
                      </span>
                      <span className="price">{formatCents(l.unitPriceCents)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="split-panel" data-mode="AMOUNT">
            <label>
              Importe (€)
              <input name="amount" inputMode="decimal" placeholder="20,00" autoComplete="off" />
            </label>
          </div>
        </fieldset>
      )}

      {coupons.length > 0 && (
        <fieldset className="split">
          <legend>¿Usas un cupón?</legend>
          <div className="split-options">
            <label className="option">
              <input type="radio" name="couponId" value="" defaultChecked />
              <span>No usar cupón</span>
            </label>
            {coupons.map((c) => (
              <label key={c.id} className="option">
                <input type="radio" name="couponId" value={c.id} />
                <span>
                  🎁 {c.title}
                  <strong>−{formatCents(c.discountCents)}</strong>
                </span>
              </label>
            ))}
          </div>
          {preview.belowMinimum && (
            <p className="hint">Este cupón no llega al gasto mínimo con lo que pagas.</p>
          )}
        </fieldset>
      )}

      {tips.enabled && (
        <fieldset className="tips">
          <legend>¿Dejas propina?</legend>
          <div className="tip-options">
            {tips.percentages.map((pct) => (
              <label key={pct} className="chip">
                <input type="radio" name="tip" value={`pct:${pct}`} defaultChecked={pct === 0} />
                {pct === 0 ? 'Sin propina' : `${pct} %`}
              </label>
            ))}
            <label className="chip">
              <input type="radio" name="tip" value="custom" />
              Otra
            </label>
          </div>
          <label className="custom-tip">
            Importe de la propina (€)
            <input name="tipCustom" inputMode="decimal" placeholder="2,00" autoComplete="off" />
          </label>
        </fieldset>
      )}

      <dl className="totals">
        <div>
          <dt>{bill ? 'Tu parte' : 'Importe'}</dt>
          <dd>{formatCents(preview.amount)}</dd>
        </div>
        {preview.discount > 0 && (
          <div className="discount">
            <dt>Cupón</dt>
            <dd>−{formatCents(preview.discount)}</dd>
          </div>
        )}
        {preview.tip > 0 && (
          <div>
            <dt>Propina</dt>
            <dd>{formatCents(preview.tip)}</dd>
          </div>
        )}
        <div className="grand">
          <dt>Total</dt>
          <dd>{formatCents(total)}</dd>
        </div>
      </dl>

      {overLimit && (
        <p className="error" role="alert">
          El total supera {formatCents(guestMaxPaymentCents)}, el máximo para pagar sin cuenta.
          Divide la cuenta o pídela al personal.
        </p>
      )}
      {tooMuch && (
        <p className="error" role="alert">
          Solo quedan {formatCents(bill!.availableCents)} por pagar.
        </p>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="pay-button" type="submit" disabled={pending || overLimit || tooMuch}>
        {pending
          ? 'Preparando el pago…'
          : preview.amount > 0
            ? `Pagar ${formatCents(total)}`
            : 'Pagar'}
      </button>
      <p className="fine-print">Pago seguro procesado por nuestro proveedor de pagos.</p>
    </form>
  );
}
