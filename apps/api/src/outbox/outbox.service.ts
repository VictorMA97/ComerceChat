import { Injectable } from '@nestjs/common';
import type { Tx } from '../db/client.js';
import { outboxEvents } from '../db/schema/index.js';

export interface DomainEvent {
  aggregate: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Patrón outbox (ARCHITECTURE §5): el evento se guarda en la misma transacción que el cambio.
 * El publicador (worker) llega en P2.
 */
@Injectable()
export class OutboxService {
  async enqueue(tx: Tx, event: DomainEvent): Promise<void> {
    await tx.insert(outboxEvents).values(event);
  }
}
