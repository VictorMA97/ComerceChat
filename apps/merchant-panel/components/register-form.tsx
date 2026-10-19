'use client';

import { useActionState } from 'react';
import { register, type RegisterState } from '@/lib/actions';

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, {});
  const v = state.values ?? {};
  return (
    <form action={action}>
      <label>
        Nombre comercial
        <input name="brandName" required minLength={2} maxLength={80} defaultValue={v.brandName} />
      </label>
      <label>
        Razón social
        <input name="legalName" required minLength={2} maxLength={120} defaultValue={v.legalName} />
      </label>
      <label>
        NIF/CIF
        <input
          name="taxId"
          required
          pattern="[A-Za-z0-9]{9}"
          title="9 letras o números"
          defaultValue={v.taxId}
        />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required defaultValue={v.email} />
      </label>
      <label>
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </label>
      <label>
        Repite la contraseña
        <input
          name="password2"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
