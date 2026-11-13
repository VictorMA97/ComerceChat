import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { FakeCheckoutOutcome, FakeCheckoutSession } from '@comercechat/shared-types';
import { and, eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { AppError, randomBase62, QueueName, QueueService } from '@comercechat/service-kit';
import { ENV, type Env } from './config/env.js';
import { DB, type Database } from './db/db.module.js';
import { fakePspSessions } from './db/schema.js';
import { FAKE_PSP_SIGNATURE_HEADER, signFakePspPayload } from './fake-psp-signature.js';

interface DeliveryJob {
  url: string;
  body: string;
}

/** Comisión simulada del PSP [HIPÓTESIS de CONTEXT §9: ~1,4 % + 0,15 €]. */
const fakePspFee = (totalCents: number) => Math.round(totalCents * 0.014) + 15;

/**
 * El "PSP externo" simulado (ARCHITECTURE §16.3), como servicio aparte (MS F3). Guarda sus sesiones
 * en fake_psp.fake_psp_sessions y envía webhooks firmados por HTTP a la URL que indicó la API al
 * crear cada sesión, igual que un PSP real (incluidos reintentos).
 */
@Injectable()
export class FakePspService {
  private readonly logger = new Logger(FakePspService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly queues: QueueService,
  ) {
    this.queues.registerWorker(QueueName.FAKE_PSP_WEBHOOKS, (job) =>
      this.deliver(job.data as DeliveryJob),
    );
  }

  async createSession(input: {
    paymentId: string;
    merchantName: string;
    statementDescriptor: string;
    amountCents: number;
    platformFeeCents: number;
    returnUrl: string;
    notifyUrl: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = `fps_${randomBase62(20)}`;
    await this.db.insert(fakePspSessions).values({ id, ...input });
    return id;
  }

  async cancel(id: string): Promise<void> {
    await this.db
      .update(fakePspSessions)
      .set({ status: 'CANCELLED' })
      .where(and(eq(fakePspSessions.id, id), eq(fakePspSessions.status, 'OPEN')));
  }

  async view(id: string): Promise<FakeCheckoutSession> {
    const s = await this.db.query.fakePspSessions.findFirst({ where: eq(fakePspSessions.id, id) });
    if (!s)
      throw new AppError(
        'FAKE_PSP_SESSION_NOT_FOUND',
        HttpStatus.NOT_FOUND,
        'Sesión de pago no encontrada',
      );
    const expired = s.status === 'OPEN' && s.expiresAt.getTime() <= Date.now();
    return {
      id: s.id,
      status: expired ? 'EXPIRED' : s.status,
      merchantName: s.merchantName,
      statementDescriptor: s.statementDescriptor,
      amountCents: s.amountCents,
      currency: 'EUR',
      returnUrl: s.returnUrl,
    };
  }

  /** El comensal pulsa un botón en la página del PSP simulado. */
  async complete(id: string, outcome: FakeCheckoutOutcome): Promise<{ returnUrl: string }> {
    const event = await this.db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(fakePspSessions)
        .where(eq(fakePspSessions.id, id))
        .for('update');
      if (!s)
        throw new AppError(
          'FAKE_PSP_SESSION_NOT_FOUND',
          HttpStatus.NOT_FOUND,
          'Sesión de pago no encontrada',
        );
      if (s.status !== 'OPEN' || s.expiresAt.getTime() <= Date.now()) {
        throw new AppError(
          'FAKE_PSP_SESSION_CLOSED',
          HttpStatus.CONFLICT,
          'Esta sesión de pago ya no está disponible',
        );
      }
      const succeeded = outcome === 'succeed';
      await tx
        .update(fakePspSessions)
        .set({ status: succeeded ? 'SUCCEEDED' : 'FAILED' })
        .where(eq(fakePspSessions.id, id));
      return {
        id: `evt_${randomBase62(20)}`,
        type: succeeded ? 'payment.succeeded' : 'payment.failed',
        created: Math.floor(Date.now() / 1000),
        data: {
          session_id: s.id,
          amount: s.amountCents,
          ...(succeeded
            ? {
                charge_id: `fch_${randomBase62(20)}`,
                method: 'CARD',
                card_last4: '4242',
                psp_fee: fakePspFee(s.amountCents),
              }
            : {
                failure_reason: outcome === 'fail_3ds' ? 'authentication_failed' : 'card_declined',
              }),
        },
        returnUrl: s.returnUrl,
        notifyUrl: s.notifyUrl,
      };
    });

    const { returnUrl, notifyUrl, ...payload } = event;
    await this.enqueueDelivery(notifyUrl, JSON.stringify(payload));
    return { returnUrl };
  }

  /** En modo caos el webhook se retrasa 0–10 s y se envía 1–3 veces. */
  private async enqueueDelivery(url: string, body: string): Promise<void> {
    const chaos = this.env.FAKE_PSP_CHAOS === 'on';
    const copies = chaos ? randomInt(1, 4) : 1;
    for (let i = 0; i < copies; i++) {
      await this.queues.add(
        QueueName.FAKE_PSP_WEBHOOKS,
        'deliver',
        { url, body } satisfies DeliveryJob,
        {
          delayMs: chaos ? randomInt(0, 10_000) : 0,
          attempts: 8,
          backoffMs: 1_000,
        },
      );
    }
  }

  private async deliver({ url, body }: DeliveryJob): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [FAKE_PSP_SIGNATURE_HEADER]: signFakePspPayload(this.env.FAKE_PSP_WEBHOOK_SECRET, body),
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`El webhook respondió ${res.status} en ${url}`);
    }
    this.logger.debug(`Webhook entregado: ${body.slice(0, 60)}…`);
  }
}
