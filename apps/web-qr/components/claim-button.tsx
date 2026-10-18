'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { claimPoints, type SignInState } from '@/lib/user-actions';

export function ClaimButton({
  paymentId,
  statusToken,
  points,
}: {
  paymentId: string;
  statusToken: string;
  points: number;
}) {
  const [state, action, pending] = useActionState<SignInState>(
    claimPoints.bind(null, paymentId, statusToken),
    {
      step: 'phone',
    },
  );
  if (state.step === 'done' && state.claim) {
    return (
      <div aria-live="polite">
        <p className="big">+{state.claim.pointsEarned} puntos guardados</p>
        <p>Tienes {state.claim.balance} puntos.</p>
        <Link href="/cuenta">Ver mis puntos y cupones</Link>
      </div>
    );
  }
  return (
    <form action={action}>
      {state.error && <p className="error">{state.error}</p>}
      <button className="pay-button" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : `Guardar mis ${points} puntos`}
      </button>
    </form>
  );
}
