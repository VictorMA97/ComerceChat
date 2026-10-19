'use server';

import type {
  LoginResponse,
  MerchantLoginResult,
  MfaActivateResponse,
} from '@comercechat/shared-types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, MFA_COOKIE, SESSION_COOKIE } from './api';

export interface LoginState {
  /** Paso del formulario: contraseña o código del doble factor. */
  step?: 'password' | 'code';
  error?: string;
  /** Se devuelve para no vaciar el email tras un error (React resetea el formulario). */
  email?: string;
}

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const errorOf = (err: unknown) =>
  err instanceof ApiError
    ? err.problem.title
    : 'No se ha podido conectar con la API. ¿Está arrancada?';

async function startSession(res: LoginResponse): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, res.accessToken, { ...COOKIE_BASE, maxAge: res.expiresIn });
  jar.delete(MFA_COOKIE);
}

/** Guarda el token intermedio del doble factor y dice a qué paso ir. */
async function nextStep(res: MerchantLoginResult): Promise<'done' | 'code' | 'setup'> {
  if (res.step === 'DONE') {
    await startSession(res);
    return 'done';
  }
  (await cookies()).set(MFA_COOKIE, res.mfaToken, { ...COOKIE_BASE, maxAge: res.expiresIn });
  return res.step === 'MFA_REQUIRED' ? 'code' : 'setup';
}

export async function login(prev: LoginState, form: FormData): Promise<LoginState> {
  if (prev.step === 'code') return verifyMfa(prev, form);
  const email = String(form.get('email') ?? '');
  let next: 'done' | 'code' | 'setup';
  try {
    const res = await api<MerchantLoginResult>('/merchant/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: form.get('password') }),
    });
    next = await nextStep(res);
  } catch (err) {
    return { step: 'password', error: errorOf(err), email };
  }
  if (next === 'code') return { step: 'code', email };
  redirect(next === 'setup' ? '/activar-2fa' : '/');
}

/** Segundo paso: código de la app de autenticación o código de recuperación. */
async function verifyMfa(prev: LoginState, form: FormData): Promise<LoginState> {
  const mfaToken = (await cookies()).get(MFA_COOKIE)?.value;
  if (!mfaToken)
    return { step: 'password', email: prev.email, error: 'La verificación ha caducado' };
  const input = String(form.get('code') ?? '').trim();
  try {
    const res = await api<LoginResponse>('/merchant/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(
        /^\d{6}$/.test(input) ? { mfaToken, code: input } : { mfaToken, recoveryCode: input },
      ),
    });
    await startSession(res);
  } catch (err) {
    const expired = err instanceof ApiError && err.problem.code === 'MFA_CHALLENGE_INVALID';
    return { step: expired ? 'password' : 'code', email: prev.email, error: errorOf(err) };
  }
  redirect('/');
}

export interface RegisterState {
  error?: string;
  values?: Record<string, string>;
}

/** Registro del comercio (FR-MER-01): después, activar el doble factor. */
export async function register(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const values = Object.fromEntries(
    ['brandName', 'legalName', 'taxId', 'email'].map((k) => [k, String(form.get(k) ?? '')]),
  );
  if (form.get('password') !== form.get('password2')) {
    return { error: 'Las contraseñas no coinciden', values };
  }
  try {
    const res = await api<MerchantLoginResult>('/merchant/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...values, password: form.get('password') }),
    });
    await nextStep(res);
  } catch (err) {
    const detail =
      err instanceof ApiError && err.problem.errors
        ? Object.values(err.problem.errors).flat().join('. ')
        : undefined;
    return { error: detail ?? errorOf(err), values };
  }
  redirect('/activar-2fa');
}

export interface ActivateState {
  error?: string;
  recoveryCodes?: string[];
}

/** Confirma el secreto con un código de la app: activa el doble factor e inicia sesión. */
export async function activateMfa(_prev: ActivateState, form: FormData): Promise<ActivateState> {
  const mfaToken = (await cookies()).get(MFA_COOKIE)?.value;
  if (!mfaToken) return { error: 'La verificación ha caducado. Vuelve a iniciar sesión.' };
  try {
    const res = await api<MfaActivateResponse>('/merchant/auth/mfa/activate', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code: String(form.get('code') ?? '').trim() }),
    });
    await startSession(res);
    // Se muestran una sola vez, en el propio formulario.
    return { recoveryCodes: res.recoveryCodes };
  } catch (err) {
    return { error: errorOf(err) };
  }
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

export interface FormState {
  error?: string;
  ok?: boolean;
}

const num = (form: FormData, key: string) => Number(String(form.get(key) ?? '').replace(',', '.'));

/** Alta de un local con sus primeras mesas (FR-MER-03/04). */
export async function createLocation(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await api('/merchant/locations', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        address: form.get('address'),
        category: form.get('category'),
        lat: num(form, 'lat'),
        lng: num(form, 'lng'),
        tableCount: num(form, 'tableCount'),
      }),
    });
  } catch (err) {
    return { error: errorOf(err) };
  }
  revalidatePath('/');
  return { ok: true };
}

export async function addTables(
  locationId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await api(`/merchant/locations/${encodeURIComponent(locationId)}/tables`, {
      method: 'POST',
      body: JSON.stringify({ count: num(form, 'count'), capacity: num(form, 'capacity') }),
    });
  } catch (err) {
    return { error: errorOf(err) };
  }
  revalidatePath('/');
  return { ok: true };
}

/** PoC: alta ante el PSP simulado (en el MVP, flujo alojado del PSP: FR-MER-02). */
export async function simulatePspOnboarding(): Promise<void> {
  await api('/merchant/psp/onboarding/simulate', { method: 'POST' });
  revalidatePath('/');
}
