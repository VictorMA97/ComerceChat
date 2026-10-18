'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export interface PromotionState {
  error?: string;
  ok?: boolean;
}

const euros = (v: FormDataEntryValue | null) =>
  Math.round(Number(String(v ?? '').replace(',', '.')) * 100);

export async function createPromotion(
  _prev: PromotionState,
  form: FormData,
): Promise<PromotionState> {
  try {
    await api('/merchant/promotions', {
      method: 'POST',
      body: JSON.stringify({
        name: String(form.get('name') ?? ''),
        discountCents: euros(form.get('discount')),
        minSpendCents: euros(form.get('minSpend') || '0'),
        validDays: Number(form.get('validDays')),
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.problem.title };
    throw err;
  }
  revalidatePath('/promociones');
  return { ok: true };
}

export async function endPromotion(id: string): Promise<void> {
  await api(`/merchant/promotions/${id}/end`, { method: 'POST' });
  revalidatePath('/promociones');
}
