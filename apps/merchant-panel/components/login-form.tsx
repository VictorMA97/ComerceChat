'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/lib/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const error = state.error && (
    <p className="error" role="alert">
      {state.error}
    </p>
  );

  if (state.step === 'code') {
    return (
      <form action={action} key="code">
        <p className="muted" style={{ margin: 0 }}>
          Escribe el código de 6 dígitos de tu app de autenticación para <b>{state.email}</b>.
        </p>
        <label>
          Código
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            maxLength={14}
            placeholder="123456"
          />
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          ¿Sin el móvil? Escribe uno de tus códigos de recuperación.
        </p>
        {error}
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Comprobando…' : 'Entrar'}
        </button>
      </form>
    );
  }

  return (
    <form action={action} key="password">
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
      {error}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
