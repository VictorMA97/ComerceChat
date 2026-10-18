import 'server-only';
import type { ProblemDetails } from '@comercechat/shared-types';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'cc_session';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }
}

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Llama a la API desde el servidor de Next con el token de la sesión (cookie httpOnly). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${apiBase()}/v1${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(body as ProblemDetails);
  return body as T;
}

export const isUnauthenticated = (err: unknown): boolean =>
  err instanceof ApiError && err.problem.status === 401;
