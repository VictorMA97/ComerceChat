import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { DB, type Database } from '../db/client.js';
import {
  orderAllocations,
  payments,
  pspWebhookEvents,
  qrCodes,
  transactions,
} from '../db/schema/index.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { QueueName, QueueService } from '../queue/queue.service.js';
import { CouponsService } from '../loyalty/coupons.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { TableBillService } from '../tables/table-bill.service.js';
import {
  InvalidWebhookSignatureError,
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PspEvent,
} from './payment-provider.js';

export const PAYMENT_CAPTURED = 'PaymentCaptured';

/**
 * Webhooks del PSP (ADR-015): se verifica la firma, se guardan deduplicados por psp_event_id, se
 * responde 200 y se procesan en el worker. Solo aquí un pago pasa a CAPTURED.
 */
@Injectable()
export class PaymentEventsService {
  private readonly logger = new Logger(PaymentEventsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly queues: QueueService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {
    this.queues.registerWorker(QueueName.PSP_EVENTS, (job) =>
      this.process((job.data as { eventId: string }).eventId),
    );
  }

  async ingest(
    providerName: string,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    if (providerName !== this.provider.name || !rawBody) {
      throw new AppError(
        'WEBHOOK_PROVIDER_UNKNOWN',
        HttpStatus.NOT_FOUND,
        'Proveedor de pagos desconocido',
      );
    }
    let event: PspEvent;
    try {
      event = this.provider.verifyAndParseWebhook(rawBody, headers);
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError || err instanceof SyntaxError) {
        throw new AppError(
          'WEBHOOK_SIGNATURE_INVALID',
          HttpStatus.BAD_REQUEST,
          'Firma del webhook no válida',
        );
      }
      throw err;
    }

    const [inserted] = await this.db
      .insert(pspWebhookEvents)
      .values({ psp: providerName, pspEventId: event.id, type: event.type, payload: event })
      .onConflictDoNothing()
      .returning({ id: pspWebhookEvents.id });
    const row =
      inserted ??
      (await this.db.query.pspWebhookEvents.findFirst({
        where: and(
          eq(pspWebhookEvents.psp, providerName),
          eq(pspWebhookEvents.pspEventId, event.id),
        ),
      }));
    // Duplicado ya procesado: nada que hacer. Si no se procesó (p. ej. caída), se vuelve a encolar.
    if (row && !('processedAt' in row && row.processedAt)) {
      await this.queues.add(
        QueueName.PSP_EVENTS,
        event.type,
        { eventId: row.id },
        {
          jobId: row.id,
          attempts: 10,
          backoff: { type: 'exponential', delay: 1_000 },
        },
      );
    }
  }

  /** Procesa un evento guardado. Idempotente: repetirlo no cambia nada. */
  async process(eventId: string): Promise<void> {
    const changed = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(pspWebhookEvents)
        .where(eq(pspWebhookEvents.id, eventId))
        .for('update');
      if (!row || row.processedAt) return null;
      const ev = row.payload as PspEvent;

      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.pspPaymentId, ev.pspPaymentId))
        .for('update');
      if (!payment) throw new Error(`Pago desconocido para ${ev.pspPaymentId}: se reintentará`);

      if (
        ev.type === 'payment.succeeded' &&
        !['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'CHARGED_BACK'].includes(
          payment.status,
        )
      ) {
        const capturedAfterCancel = payment.status === 'FAILED';
        // Su parte de la cuenta queda pagada (también si se había liberado: el PSP manda).
        await tx
          .update(orderAllocations)
          .set({ status: 'PAID' })
          .where(eq(orderAllocations.paymentId, payment.id));
        // Cupón usado en el pago: canje definitivo (FR-CPN-06).
        await CouponsService.redeem(tx, payment.id, payment.discountCents);
        if (payment.qrCodeId) {
          // QR dinámico de un solo uso: queda consumido (FR-QR-03).
          await tx
            .update(qrCodes)
            .set({ status: 'CONSUMED' })
            .where(and(eq(qrCodes.id, payment.qrCodeId), eq(qrCodes.status, 'ACTIVE')));
        }
        await tx
          .update(payments)
          .set({
            status: 'CAPTURED',
            failureReason: null,
            capturedAt: new Date(ev.occurredAt),
            method: ev.method ?? 'CARD',
            cardLast4: ev.cardLast4 ?? null,
            pspFeeCents: ev.pspFeeCents ?? null,
          })
          .where(eq(payments.id, payment.id));
        const chargeRef = ev.chargeId ?? ev.id;
        await tx
          .insert(transactions)
          .values([
            {
              paymentId: payment.id,
              type: 'CHARGE',
              amountCents: ev.amountCents,
              pspReference: chargeRef,
              occurredAt: new Date(ev.occurredAt),
            },
            {
              paymentId: payment.id,
              type: 'FEE',
              amountCents: payment.platformFeeCents,
              pspReference: `${chargeRef}:platform_fee`,
              occurredAt: new Date(ev.occurredAt),
            },
          ])
          .onConflictDoNothing();
        await this.outbox.enqueue(tx, {
          aggregate: 'payment',
          aggregateId: payment.id,
          type: PAYMENT_CAPTURED,
          payload: { paymentId: payment.id },
        });
        if (capturedAfterCancel) {
          // El PSP cobró una sesión que dimos por sustituida o caducada: hay que revisarla y reembolsar.
          this.logger.error(
            `Pago ${payment.id} capturado tras cancelarse (${payment.failureReason})`,
          );
          await this.audit.record(
            {
              actorType: 'SYSTEM',
              action: 'payment.captured_after_cancel',
              entity: 'payment',
              entityId: payment.id,
              before: { failureReason: payment.failureReason },
            },
            tx,
          );
        }
      } else if (
        ev.type === 'payment.failed' &&
        ['CREATED', 'AUTHORIZED'].includes(payment.status)
      ) {
        await tx
          .update(payments)
          .set({ status: 'FAILED', failureReason: ev.failureReason ?? 'PAYMENT_FAILED' })
          .where(eq(payments.id, payment.id));
        await TableBillService.releaseAllocations(tx, [payment.id]);
      }

      await tx
        .update(pspWebhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(pspWebhookEvents.id, row.id));
      return { payment, type: ev.type };
    });
    if (changed) {
      const p = changed.payment;
      const reason = changed.type === 'payment.succeeded' ? 'payment.captured' : 'payment.failed';
      await this.realtime.publish({
        type: 'table.updated',
        locationId: p.locationId,
        tableId: p.tableId ?? undefined,
        qrId: p.qrCodeId ?? undefined,
        reason,
      });
    }
  }
}
