'use client';

import { useActionState } from 'react';
import { addTables, createLocation, type FormState } from '@/lib/actions';

const Status = ({ state, ok }: { state: FormState; ok: string }) =>
  state.error ? (
    <p className="error" role="alert">
      {state.error}
    </p>
  ) : state.ok ? (
    <p className="ok-text" role="status">
      {ok}
    </p>
  ) : null;

/** Alta de un local con sus primeras mesas (FR-MER-03/04). Coordenadas: centro de Madrid. */
export function NewLocationForm({ open }: { open: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createLocation, {});
  return (
    <details className="card new-location no-print" open={open}>
      <summary>Nuevo local</summary>
      <form action={action} className="stack-form">
        <label>
          Nombre
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Casa Pepe Lavapiés"
          />
        </label>
        <label>
          Dirección
          <input
            name="address"
            required
            minLength={5}
            maxLength={200}
            placeholder="Calle de Argumosa 1, 28012 Madrid"
          />
        </label>
        <div className="form-row">
          <label>
            Tipo
            <select name="category" defaultValue="restaurant">
              <option value="restaurant">Restaurante</option>
              <option value="bar">Bar</option>
              <option value="cafe">Cafetería</option>
            </select>
          </label>
          <label>
            Mesas
            <input name="tableCount" type="number" min={0} max={50} defaultValue={8} required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Latitud
            <input name="lat" inputMode="decimal" required defaultValue="40.4168" />
          </label>
          <label>
            Longitud
            <input name="lng" inputMode="decimal" required defaultValue="-3.7038" />
          </label>
        </div>
        <Status state={state} ok="Local creado con sus mesas y QR." />
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Creando…' : 'Crear local'}
        </button>
      </form>
    </details>
  );
}

export function AddTablesForm({ locationId }: { locationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addTables.bind(null, locationId),
    {},
  );
  return (
    <form action={action} className="inline-form no-print">
      <label>
        Añadir
        <input name="count" type="number" min={1} max={50} defaultValue={1} required />
        mesas de
        <input name="capacity" type="number" min={1} max={20} defaultValue={4} required />
        personas
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Añadiendo…' : 'Añadir'}
      </button>
      <Status state={state} ok="Mesas añadidas." />
    </form>
  );
}
