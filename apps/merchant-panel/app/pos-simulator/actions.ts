'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

const refresh = () => revalidatePath('/pos-simulator');

export async function addItem(tableId: string, form: FormData): Promise<void> {
  await api(`/merchant/fake-pos/tables/${encodeURIComponent(tableId)}/items`, {
    method: 'POST',
    body: JSON.stringify({ menuItemId: form.get('menuItemId'), qty: Number(form.get('qty') || 1) }),
  });
  refresh();
}

export async function removeItem(itemId: string): Promise<void> {
  await api(`/merchant/fake-pos/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  refresh();
}

export async function closeBill(tableId: string): Promise<void> {
  await api(`/merchant/fake-pos/tables/${encodeURIComponent(tableId)}/close`, { method: 'POST' });
  refresh();
}

export async function setHealth(locationId: string, healthy: boolean): Promise<void> {
  await api(`/merchant/fake-pos/locations/${encodeURIComponent(locationId)}/health`, {
    method: 'POST',
    body: JSON.stringify({ healthy }),
  });
  refresh();
}

export interface PaymentQrState {
  error?: string;
}

/** «Cobrar con QR»: genera el QR de cobro de la mesa por lo que queda por pagar (FR-QR-03). */
export async function createPaymentQr(
  tableId: string,
  _prev: PaymentQrState,
): Promise<PaymentQrState> {
  try {
    await api(`/merchant/tables/${encodeURIComponent(tableId)}/payment-qr`, { method: 'POST' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.problem.title };
    throw err;
  }
  refresh();
  return {};
}

export async function revokePaymentQr(qrId: string): Promise<void> {
  await api(`/merchant/dynamic-qr/${encodeURIComponent(qrId)}/revoke`, { method: 'POST' });
  refresh();
}
