'use server';

import type {
  CreatePaymentSessionRequest,
  PaymentSessionResponse,
} from '@comercechat/shared-types';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { ApiError } from '@/lib/api';
import { guestSessionId } from '@/lib/guest';
import { readCouponId, readSplit, readTip } from '@/lib/pay-form';
import { apiAsUser } from '@/lib/user';

export interface PayState {
  error?: string;
}

/**
 * Crea la sesión de pago y lleva al comensal a la página del PSP. El reparto y la propina se leen
 * del formulario aquí, no del JavaScript del navegador (que puede no haber cargado aún).
 */
export async function startPayment(_prev: PayState, form: FormData): Promise<PayState> {
  const qrCode = form.get('qrCode');
  const dynamicToken = form.get('dynamicToken');
  const body: CreatePaymentSessionRequest = {
    ...(qrCode
      ? { qrCode: String(qrCode), split: readSplit(form) }
      : { dynamicToken: String(dynamicToken) }),
    tip: readTip(form),
    guestSessionId: await guestSessionId(),
    couponId: readCouponId(form),
  };
  // Un doble envío de la misma elección reutiliza la sesión (Idempotency-Key, ADR-015).
  const digest = createHash('sha256')
    .update(JSON.stringify([body.split, body.tip, body.couponId]))
    .digest('hex')
    .slice(0, 24);
  const idempotencyKey = `${String(form.get('idempotencyBase'))}:${digest}`;

  let session: PaymentSessionResponse;
  try {
    // Con sesión de usuario, el pago queda a su nombre (puntos automáticos y cupones).
    session = await apiAsUser<PaymentSessionResponse>('/payment-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.problem.title };
    throw err;
  }
  redirect(session.checkoutUrl);
}
