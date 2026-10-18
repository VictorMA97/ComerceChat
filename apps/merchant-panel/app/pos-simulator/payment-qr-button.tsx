'use client';

import { useActionState } from 'react';
import { createPaymentQr, type PaymentQrState } from './actions';

export function PaymentQrButton({ tableId, label }: { tableId: string; label: string }) {
  const [state, action, pending] = useActionState<PaymentQrState>(
    createPaymentQr.bind(null, tableId),
    {},
  );
  return (
    <form action={action} className="pos-qr-button">
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Generando…' : label}
      </button>
      {state.error && (
        <p className="error small" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
