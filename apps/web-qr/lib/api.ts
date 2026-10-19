import 'server-only';
import { forwardedClientHeaders, requestJson, type RequestOptions } from '@comercechat/api-client';
import { headers } from 'next/headers';

export { ApiError } from '@comercechat/api-client';

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Llama a la API desde el servidor de Next. El navegador del comensal nunca habla con la API
 * directamente: así solo hace falta exponer la web QR (p. ej. por el túnel de `pnpm poc:tunnel`).
 * Reenvía la IP del navegador para que la API aplique sus límites por cliente.
 * Cualquier fallo llega como `ApiError` (ver `@comercechat/api-client`).
 */
export async function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const h = new Headers(init.headers);
  const forwarded = forwardedClientHeaders(await headers(), process.env.INTERNAL_PROXY_SECRET);
  for (const [k, v] of Object.entries(forwarded)) h.set(k, v);
  return requestJson<T>(`${apiBase()}/v1${path}`, { ...init, cache: 'no-store', headers: h });
}
