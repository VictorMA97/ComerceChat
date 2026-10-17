'use server';

import type { LoginResponse } from '@comercechat/shared-types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, SESSION_COOKIE } from './api';

export interface LoginState {
  error?: string;
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
    if (err instanceof ApiError) return { error: err.problem.title };
    return { error: 'No se ha podido conectar con la API. ¿Está arrancada?' };
  }
  redirect('/');
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function regenerateQr(tableId: string): Promise<void> {
  await api(`/merchant/tables/${tableId}/qr/regenerate`, { method: 'POST' });
  revalidatePath('/');
}
