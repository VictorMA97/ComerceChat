import { Inject, Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@comercechat/shared-types';
import { ENV, type Env, webQrBaseUrl } from '../../config/env.js';
import {
  type CreatePaymentSessionInput,
  InvalidWebhookSignatureError,
  type PaymentProvider,
  type PspEvent,
} from '../payment-provider.js';
import { FAKE_PSP_SIGNATURE_HEADER, verifyFakePspSignature } from './fake-psp-signature.js';
import { FakePspService } from './fake-psp.service.js';

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

/** Adaptador de ComerceChat para el PSP simulado: la misma interfaz que tendrá el PSP real. */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly psp: FakePspService,
  ) {}

  async createPaymentSession(input: CreatePaymentSessionInput) {
    const pspPaymentId = await this.psp.createSession({
      paymentId: input.paymentId,
      merchantName: input.merchantName,
      statementDescriptor: input.statementDescriptor,
      amountCents: input.totalCents,
      platformFeeCents: input.platformFeeCents,
      returnUrl: input.returnUrl,
      expiresAt: input.expiresAt,
    });
    return {
      pspPaymentId,
      checkoutUrl: `${webQrBaseUrl(this.env).replace(/\/$/, '')}/fake-psp/checkout/${pspPaymentId}`,
    };
  }

  cancelPaymentSession(pspPaymentId: string): Promise<void> {
    return this.psp.cancel(pspPaymentId);
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
