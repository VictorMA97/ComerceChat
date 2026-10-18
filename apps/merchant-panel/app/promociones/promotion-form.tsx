'use client';

import { useActionState } from 'react';
import { createPromotion, type PromotionState } from './actions';

export function PromotionForm() {
  const [state, action, pending] = useActionState<PromotionState, FormData>(createPromotion, {});
  return (
    <form action={action} className="card promo-form">
      <h2>Nueva promoción «Vuelve y te invitamos»</h2>
      <p className="muted small">
        Cada cliente que guarda sus puntos por primera vez recibe un cupón para su próxima visita.
        Sustituye a la promoción activa.
      </p>
      <label>
        Nombre que verá el cliente
        <input
          name="name"
          defaultValue="Vuelve y te invitamos: 5 € en tu próxima visita"
          required
          minLength={3}
          maxLength={80}
        />
      </label>
      <div className="promo-row">
        <label>
          Descuento (€)
          <input name="discount" inputMode="decimal" defaultValue="5" required />
        </label>
        <label>
          Gasto mínimo (€)
          <input name="minSpend" inputMode="decimal" defaultValue="20" />
        </label>
        <label>
          Válido (días)
          <input name="validDays" type="number" min={1} max={365} defaultValue={30} required />
        </label>
      </div>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && <p className="ok">Promoción activada.</p>}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Activar promoción'}
      </button>
    </form>
  );
}
