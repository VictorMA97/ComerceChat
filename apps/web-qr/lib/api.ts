import 'server-only';
import type { ProblemDetails } from '@comercechat/shared-types';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }
}

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Llama a la API desde el servidor de Next. El navegador del comensal nunca habla con la API
 * directamente: así solo hace falta exponer la web QR (p. ej. por el túnel de `pnpm poc:tunnel`).
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/v1${path}`, {
      ...init,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError({
      type: 'about:blank',
      title: 'No hemos podido conectar. Inténtalo de nuevo en unos segundos.',
      status: 503,
      code: 'API_UNREACHABLE',
    });
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body as ProblemDetails);
  return body as T;
}
