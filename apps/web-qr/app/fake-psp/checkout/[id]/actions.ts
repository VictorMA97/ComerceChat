'use server';

import type { FakeCheckoutOutcome } from '@comercechat/shared-types';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

/**
 * Resultado elegido en el PSP simulado. Se usa como acción de formularios nativos: funciona aunque
 * el JavaScript de la página no haya cargado (mejora progresiva, ADR-021).
 */
export async function completeCheckout(sessionId: string, outcome: FakeCheckoutOutcome): Promise<void> {
  let returnUrl: string;
  try {
    ({ returnUrl } = await api<{ returnUrl: string }>(
      `/fake-psp/sessions/${encodeURIComponent(sessionId)}/complete`,
      { method: 'POST', body: JSON.stringify({ outcome }) },
    ));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    redirect(`/fake-psp/checkout/${encodeURIComponent(sessionId)}?error=${encodeURIComponent(err.problem.title)}`);
  }
  redirect(returnUrl);
}
