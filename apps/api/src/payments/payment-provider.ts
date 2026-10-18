import type { PaymentMethod } from '@comercechat/shared-types';

export interface CreatePaymentSessionInput {
  paymentId: string;
  pspAccountId: string | null;
  /** Total a cobrar al comensal (importe + propina). */
  totalCents: number;
  platformFeeCents: number;
  currency: 'EUR';
  statementDescriptor: string;
  merchantName: string;
  returnUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
}

/** Evento del PSP ya verificado y normalizado. */
export interface PspEvent {
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  pspPaymentId: string;
  occurredAt: Date;
  amountCents: number;
  chargeId?: string;
  method?: PaymentMethod;
  cardLast4?: string;
  pspFeeCents?: number;
  failureReason?: string;
}

/**
 * Abstracción del PSP (ARCHITECTURE §6.1). En la PoC, `FakePaymentProvider` (ADR-018); el
 * adaptador real llega con D-01. El dinero nunca pasa por ComerceChat (REG-01): el PSP cobra al
 * comensal, liquida al comercio y descuenta la comisión de plataforma.
 */
export interface PaymentProvider {
  readonly name: string;
  createPaymentSession(
    input: CreatePaymentSessionInput,
  ): Promise<{ pspPaymentId: string; checkoutUrl: string }>;
  cancelPaymentSession(pspPaymentId: string): Promise<void>;
  /** Verifica la firma sobre el cuerpo en bruto. Lanza `InvalidWebhookSignatureError` si no es válida. */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): PspEvent;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export class InvalidWebhookSignatureError extends Error {}
