import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, isUnauthenticated, SESSION_COOKIE } from './api';

/** Llama a la API con la sesión; si no hay sesión o ha caducado, manda al login. */
export async function apiOrLogin<T>(path: string): Promise<T> {
  if (!(await cookies()).get(SESSION_COOKIE)) redirect('/login');
  try {
    return await api<T>(path);
  } catch (err) {
    if (isUnauthenticated(err)) redirect('/login');
    throw err;
  }
}
