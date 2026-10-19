import 'server-only';
import { ApiError, requestJson, type RequestOptions } from '@comercechat/api-client';
import { cookies } from 'next/headers';

export { ApiError };

export const SESSION_COOKIE = 'cc_session';

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Llama a la API desde el servidor de Next con el token de la sesión (cookie httpOnly).
 * Cualquier fallo llega como `ApiError` (ver `@comercechat/api-client`).
 */
export async function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
  return requestJson<T>(`${apiBase()}/v1${path}`, { ...init, cache: 'no-store', headers });
}

export const isUnauthenticated = (err: unknown): boolean =>
  err instanceof ApiError && err.problem.status === 401;
