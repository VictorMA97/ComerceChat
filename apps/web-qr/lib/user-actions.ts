'use server';

import type {
  ClaimPointsResponse,
  CouponView,
  OtpStartResponse,
  UserSession,
} from '@comercechat/shared-types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from './api';
import { apiAsUser, USER_COOKIE } from './user';

export interface SignInState {
  step: 'phone' | 'code' | 'done';
  phone?: string;
  error?: string;
  /** Si se estaba reclamando un pago: resultado de la reclamación. */
  claim?: ClaimPointsResponse;
  isNew?: boolean;
}

const errorOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.problem.title : fallback;

/** Paso 1: pide el código de un solo uso para el teléfono (FR-USR-02). */
export async function requestCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const phone = String(form.get('phone') ?? '').trim();
  try {
    await api<OtpStartResponse>('/auth/otp/start', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return { step: 'code', phone };
  } catch (err) {
    return { step: 'phone', phone, error: errorOf(err, 'No hemos podido enviar el código') };
  }
}

/**
 * Paso 2: comprueba el código, guarda la sesión y, si viene de un justificante, reclama los puntos
 * de ese pago. Los consentimientos son casillas separadas y sin marcar (REG-07).
 */
export async function verifyCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const phone = String(form.get('phone') ?? '');
  const merchantId = form.get('merchantId') ? String(form.get('merchantId')) : undefined;
  let session: UserSession;
  try {
    session = await api<UserSession>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        code: String(form.get('code') ?? '').trim(),
        name: String(form.get('name') ?? '').trim() || undefined,
        consents: {
          terms: form.get('terms') === 'on',
          marketing: form.get('marketing') === 'on',
          shareWithMerchantId: form.get('share') === 'on' ? merchantId : undefined,
        },
      }),
    });
  } catch (err) {
    return { step: 'code', phone, error: errorOf(err, 'No hemos podido comprobar el código') };
  }
  (await cookies()).set(USER_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.expiresIn,
  });

  let claim: ClaimPointsResponse | undefined;
  const paymentId = form.get('paymentId');
  if (paymentId) {
    try {
      claim = await apiAsUser<ClaimPointsResponse>('/me/claim', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          paymentId: String(paymentId),
          statusToken: String(form.get('statusToken')),
        }),
      });
    } catch (err) {
      return {
        step: 'done',
        isNew: session.isNew,
        error: errorOf(err, 'No hemos podido guardar los puntos'),
      };
    }
    // Sin refrescar: el comensal ve el resultado (puntos y cupón de bienvenida) en el propio formulario.
    return { step: 'done', isNew: session.isNew, claim };
  }
  // Inicio de sesión desde «Mi cuenta»: se vuelve a pintar la página ya con la sesión.
  revalidatePath('/', 'layout');
  return { step: 'done', isNew: session.isNew };
}

/** Usuario ya identificado: guarda los puntos de un pago con un clic. */
export async function claimPoints(paymentId: string, statusToken: string): Promise<SignInState> {
  try {
    const claim = await apiAsUser<ClaimPointsResponse>('/me/claim', {
      method: 'POST',
      body: JSON.stringify({ paymentId, statusToken }),
    });
    return { step: 'done', claim };
  } catch (err) {
    return { step: 'done', error: errorOf(err, 'No hemos podido guardar los puntos') };
  }
}

export interface RedeemState {
  error?: string;
  coupon?: CouponView;
}

/** Canjea puntos por una recompensa: emite un cupón (FR-LOY-03). */
export async function redeemReward(rewardId: string, _prev: RedeemState): Promise<RedeemState> {
  try {
    const coupon = await apiAsUser<CouponView>(`/me/rewards/${rewardId}/redeem`, {
      method: 'POST',
    });
    revalidatePath('/cuenta');
    return { coupon };
  } catch (err) {
    return { error: errorOf(err, 'No se ha podido canjear') };
  }
}

/** Consentimientos desde el perfil (FR-USR-04). */
export async function setConsent(form: FormData): Promise<void> {
  const kind = String(form.get('kind'));
  const granted = form.get('granted') === 'true';
  await apiAsUser('/me/consents', {
    method: 'PUT',
    body: JSON.stringify(
      kind === 'marketing'
        ? { marketing: granted }
        : { merchantId: String(form.get('merchantId')), shareWithMerchant: granted },
    ),
  });
  revalidatePath('/cuenta');
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(USER_COOKIE);
  redirect('/cuenta');
}
