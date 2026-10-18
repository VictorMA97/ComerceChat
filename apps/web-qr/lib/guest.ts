import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

const COOKIE = 'cc_guest';

/**
 * Identificador anónimo del dispositivo del comensal. Sirve para que un nuevo intento de pago libere
 * el anterior del mismo móvil (ADR-022). Solo se puede crear desde una server action.
 */
export async function guestSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && /^[A-Za-z0-9-]{16,64}$/.test(existing)) return existing;
  const id = randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
