import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { orders, payments } from '../db/schema/index.js';
import { type DomainEventJob, OutboxRelayService } from '../outbox/outbox-relay.service.js';
import { POS_CONNECTOR, type PosConnector } from '../pos/pos-connector.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { PAYMENT_CAPTURED } from './payment-events.service.js';

/**
 * Registra en el software de caja los pagos capturados (FR-POS-04). Si el TPV falla, el job se
 * reintenta con espera exponencial (~30 min). El pago nunca se revierte (ARCHITECTURE §7).
 */
@Injectable()
export class PosSyncService implements OnModuleInit {
  private readonly logger = new Logger(PosSyncService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(POS_CONNECTOR) private readonly pos: PosConnector,
    private readonly relay: OutboxRelayService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.relay.on(PAYMENT_CAPTURED, (e) => this.registerCaptured(e));
  }

  async registerCaptured(event: DomainEventJob): Promise<void> {
    const paymentId = event.payload.paymentId as string;
    const p = await this.db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: { table: true, order: true },
    });
    if (!p || p.posRegisteredAt) return;
    if (!p.table?.externalTableId) {
      this.logger.warn(`Pago ${p.id} sin mesa enlazada con la caja: no se registra en el TPV`);
      return;
    }
    const { billClosed } = await this.pos.registerPayment(p.locationId, p.table.externalTableId, {
      amountCents: p.amountCents,
      tipCents: p.tipCents,
      discountCents: p.discountCents,
      reference: p.id,
    });
    await this.db
      .update(payments)
      .set({ posRegisteredAt: new Date() })
      .where(eq(payments.id, p.id));
    if (billClosed && p.orderId) {
      await this.db.update(orders).set({ status: 'PAID' }).where(eq(orders.id, p.orderId));
    }
    await this.realtime.publishTable(
      p.locationId,
      p.tableId,
      billClosed ? 'bill.closed' : 'bill.updated',
    );
    this.logger.log(
      `Pago ${p.id} registrado en la caja (mesa ${p.table.label}${billClosed ? ', cuenta cerrada' : ''})`,
    );
  }
}
