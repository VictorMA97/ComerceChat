'use client';

import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import { redeemReward, type RedeemState } from '@/lib/user-actions';

export function RedeemButton({
  rewardId,
  disabled,
  idempotencyKey,
}: {
  rewardId: string;
  disabled: boolean;
  /** Clave del intento de canje: se reutiliza en los reintentos para no canjear dos veces. */
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(
    redeemReward.bind(null, rewardId),
    {},
  );
  if (state.coupon) {
    return (
      <span className="tag tag-paid" aria-live="polite">
        Cupón de {formatCents(state.coupon.discountCents)} listo
      </span>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <button type="submit" className="chip" disabled={disabled || pending}>
        {pending ? 'Canjeando…' : 'Canjear'}
      </button>
      {state.error && <span className="error small">{state.error}</span>}
    </form>
  );
}
