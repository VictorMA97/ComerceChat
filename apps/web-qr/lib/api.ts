import 'server-only';
import { requestJson, type RequestOptions } from '@comercechat/api-client';

export { ApiError } from '@comercechat/api-client';

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Llama a la API desde el servidor de Next. El navegador del comensal nunca habla con la API
 * directamente: así solo hace falta exponer la web QR (p. ej. por el túnel de `pnpm poc:tunnel`).
 * Cualquier fallo llega como `ApiError` (ver `@comercechat/api-client`).
 */
export function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  return requestJson<T>(`${apiBase()}/v1${path}`, { ...init, cache: 'no-store' });
}
