import 'server-only';
import { cookies } from 'next/headers';
import { api } from './api';

/** Sesión del comensal (JWT de la API) en una cookie httpOnly: el navegador no la lee. */
export const USER_COOKIE = 'cc_user';

export async function userToken(): Promise<string | null> {
  return (await cookies()).get(USER_COOKIE)?.value ?? null;
}

/** Llama a la API como el comensal identificado (si lo está). */
export async function apiAsUser<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await userToken();
  return api<T>(path, {
    ...init,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
}
