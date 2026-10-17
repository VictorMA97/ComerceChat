'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/lib/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
        />
      </label>
      <label>
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
        />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
