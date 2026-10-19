'use server';

import type { LoginResponse } from '@comercechat/shared-types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, SESSION_COOKIE } from './api';

export interface LoginState {
  error?: string;
  /** Se devuelve para no vaciar el email tras un error (React resetea el formulario). */
  email?: string;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  try {
    const res = await api<LoginResponse>('/merchant/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    (await cookies()).set(SESSION_COOKIE, res.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: res.expiresIn,
    });
  } catch (err) {
    const email = String(form.get('email') ?? '');
    if (err instanceof ApiError) return { error: err.problem.title, email };
    return { error: 'No se ha podido conectar con la API. ¿Está arrancada?', email };
  }
  redirect('/');
}

export async function logout(): Promise<void> {
  // Se revoca el token en la API: borrar la cookie no basta si alguien se ha llevado una copia.
  await api('/merchant/auth/logout', { method: 'POST' }).catch(() => undefined);
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function regenerateQr(tableId: string): Promise<void> {
  await api(`/merchant/tables/${encodeURIComponent(tableId)}/qr/regenerate`, { method: 'POST' });
  revalidatePath('/');
}
