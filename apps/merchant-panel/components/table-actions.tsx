'use client';

import { useTransition } from 'react';
import { regenerateQr } from '@/lib/actions';

export function RegenerateQrButton({ tableId, label }: { tableId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Regenerar el QR de ${label}? El QR impreso actual dejará de funcionar.`)) {
          start(() => regenerateQr(tableId));
        }
      }}
    >
      {pending ? 'Regenerando…' : 'Regenerar QR'}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="primary" onClick={() => window.print()}>
      Imprimir placas QR
    </button>
  );
}
