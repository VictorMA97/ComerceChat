import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token del estado de un pago para el comensal sin cuenta (ADR-021): HMAC del id del pago. Da
 * acceso al justificante y a reclamar los puntos del pago, nada más.
 */
export function paymentStatusToken(secret: string, paymentId: string): string {
  return createHmac('sha256', secret)
    .update(`payment-status:${paymentId}`)
    .digest('base64url')
    .slice(0, 32);
}

export function isValidPaymentStatusToken(
  secret: string,
  paymentId: string,
  token: string | undefined,
): boolean {
  const a = Buffer.from(paymentStatusToken(secret, paymentId));
  const b = Buffer.from(token ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}
