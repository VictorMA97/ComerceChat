'use server';

import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

/** El comensal abandona un pago sin completar: libera su parte para que otro pueda pagarla. */
export async function cancelPayment(paymentId: string, token: string): Promise<void> {
  try {
    await api(`/payments/${encodeURIComponent(paymentId)}/cancel?t=${encodeURIComponent(token)}`, {
      method: 'POST',
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
  redirect(`/p/${paymentId}?t=${encodeURIComponent(token)}`);
}
