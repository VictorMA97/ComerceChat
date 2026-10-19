import 'server-only';
import {
  ApiError,
  forwardedClientHeaders,
  requestJson,
  type RequestOptions,
} from '@comercechat/api-client';
import { cookies, headers } from 'next/headers';

export { ApiError };

export const SESSION_COOKIE = 'cc_session';

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Cabeceras para la API: sesión del comercio (cookie httpOnly) e IP del navegador. */
export async function apiHeaders(init?: HeadersInit): Promise<Headers> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const h = new Headers(init);
  if (token && !h.has('authorization')) h.set('authorization', `Bearer ${token}`);
  const forwarded = forwardedClientHeaders(await headers(), process.env.INTERNAL_PROXY_SECRET);
  for (const [k, v] of Object.entries(forwarded)) h.set(k, v);
  return h;
}

/**
 * Llama a la API desde el servidor de Next con el token de la sesión (cookie httpOnly).
 * Cualquier fallo llega como `ApiError` (ver `@comercechat/api-client`).
 */
export async function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  return requestJson<T>(`${apiBase()}/v1${path}`, {
    ...init,
    cache: 'no-store',
    headers: await apiHeaders(init.headers),
  });
}

export const isUnauthenticated = (err: unknown): boolean =>
  err instanceof ApiError && err.problem.status === 401;
