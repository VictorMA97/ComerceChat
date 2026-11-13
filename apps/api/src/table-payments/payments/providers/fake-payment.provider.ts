import { Inject, Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@comercechat/shared-types';
import { FAKE_PSP_SIGNATURE_HEADER, verifyFakePspSignature } from '@comercechat/contracts';
import { InternalHttpClient } from '@comercechat/service-kit';
import { ENV, type Env, webQrBaseUrl } from '../../../config/env.js';
import {
  type CreatePaymentSessionInput,
  InvalidWebhookSignatureError,
  type PaymentProvider,
  type PspEvent,
} from '../payment-provider.js';

interface FakeWebhookBody {
  id: string;
  type: PspEvent['type'];
  created: number;
  data: {
    session_id: string;
    amount: number;
    charge_id?: string;
    method?: PaymentMethod;
    card_last4?: string;
    psp_fee?: number;
    failure_reason?: string;
  };
}

/**
 * Adaptador de ComerceChat para el PSP simulado: la misma interfaz que tendrá el PSP real. Desde MS
 * F3 el simulador es otro servicio y se le llama por HTTP, como a un PSP de verdad. Cada sesión le
 * dice adónde enviar su webhook: la URL pública de la API (el gateway).
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  private readonly psp: InternalHttpClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.psp = new InternalHttpClient('fake-psp', env.FAKE_PSP_URL, env.INTERNAL_SERVICE_SECRET);
  }

  async createPaymentSession(input: CreatePaymentSessionInput) {
    const { sessionId } = await this.psp.post<{ sessionId: string }>('/v1/internal/psp/sessions', {
      paymentId: input.paymentId,
      merchantName: input.merchantName,
      statementDescriptor: input.statementDescriptor,
      amountCents: input.totalCents,
      platformFeeCents: input.platformFeeCents,
      returnUrl: input.returnUrl,
      notifyUrl: `${this.env.API_BASE_URL.replace(/\/$/, '')}/v1/webhooks/psp/fake`,
      expiresAt: input.expiresAt.toISOString(),
    });
    return {
      pspPaymentId: sessionId,
      checkoutUrl: `${webQrBaseUrl(this.env).replace(/\/$/, '')}/fake-psp/checkout/${sessionId}`,
    };
  }

  async cancelPaymentSession(pspPaymentId: string): Promise<void> {
    await this.psp.post(`/v1/internal/psp/sessions/${encodeURIComponent(pspPaymentId)}/cancel`);
  }

  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): PspEvent {
    const header = headers[FAKE_PSP_SIGNATURE_HEADER];
    if (
      !verifyFakePspSignature(
        this.env.FAKE_PSP_WEBHOOK_SECRET,
        rawBody,
        Array.isArray(header) ? header[0] : header,
      )
    ) {
      throw new InvalidWebhookSignatureError('Firma del webhook no válida');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as FakeWebhookBody;
    return {
      id: body.id,
      type: body.type,
      pspPaymentId: body.data.session_id,
      occurredAt: new Date(body.created * 1000),
      amountCents: body.data.amount,
      chargeId: body.data.charge_id,
      method: body.data.method,
      cardLast4: body.data.card_last4,
      pspFeeCents: body.data.psp_fee,
      failureReason: body.data.failure_reason,
    };
  }
}
