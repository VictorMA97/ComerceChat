'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { activateMfa, type ActivateState } from '@/lib/actions';

interface Props {
  setup: { secret: string; qr: string } | null;
  loadError?: string;
}

export function MfaActivation({ setup, loadError }: Props) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateMfa, {});

  if (state.recoveryCodes) {
    return (
      <div className="mfa-done">
        <p className="ok">Doble factor activado.</p>
        <p>
          Guarda estos <b>códigos de recuperación</b> en un lugar seguro. Cada uno sirve una vez
          para entrar si pierdes el móvil. No se volverán a mostrar.
        </p>
        <ul className="recovery-codes">
          {state.recoveryCodes.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
        <Link className="button primary" href="/">
          Ya los he guardado: ir al panel
        </Link>
      </div>
    );
  }

  if (!setup) {
    return (
      <>
        <p className="error" role="alert">
          {loadError ?? 'La verificación ha caducado.'}
        </p>
        <Link href="/login">Volver a iniciar sesión</Link>
      </>
    );
  }

  return (
    <form action={action}>
      <p>Abre tu app de autenticación y escanea este código:</p>
      <img className="qr mfa-qr" src={setup.qr} alt="Código QR para la app de autenticación" />
      <p className="muted small">
        ¿No puedes escanearlo? Introduce esta clave a mano:{' '}
        <code className="secret">{setup.secret}</code>
      </p>
      <label>
        Código de 6 dígitos que muestra la app
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Comprobando…' : 'Activar'}
      </button>
    </form>
  );
}
