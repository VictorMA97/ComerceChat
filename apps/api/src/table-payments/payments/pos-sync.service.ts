import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/client.js';
import { VenuesDirectory } from '../../merchant-venues/public/venues-directory.js';
import { orders } from '../schema/orders.js';
import { payments } from '../schema/payments.js';
import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { POS_CONNECTOR, type PosConnector } from '@comercechat/pos-connectors';
import { RealtimeService } from '../../realtime/public/realtime.js';

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
    private readonly venues: VenuesDirectory,
  ) {}

  onModuleInit(): void {
    this.relay.on('table-payments', 'PaymentCaptured.v1', (e) =>
      this.registerCaptured(e.payload.paymentId),
    );
  }

  async registerCaptured(paymentId: string): Promise<void> {
    const [p] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    if (!p || p.posRegisteredAt) return;
    const table = p.tableId ? (await this.venues.tablePlace(p.tableId))?.table : undefined;
    if (!table?.externalTableId) {
      this.logger.warn(`Pago ${p.id} sin mesa enlazada con la caja: no se registra en el TPV`);
      return;
    }
    const { billClosed } = await this.pos.registerPayment(p.locationId, table.externalTableId, {
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
      `Pago ${p.id} registrado en la caja (mesa ${table.label}${billClosed ? ', cuenta cerrada' : ''})`,
    );
  }
}
