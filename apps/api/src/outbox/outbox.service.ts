import { Injectable } from '@nestjs/common';
import type { DomainEvents, DomainEventType } from '../contracts/events.js';
import type { Tx } from '../db/client.js';
import { outboxEvents } from '../db/schema/platform.js';

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  aggregate: string;
  aggregateId: string;
  type: T;
  payload: DomainEvents[T];
}

/**
 * Patrón outbox (ARCHITECTURE §5): el evento se guarda en la misma transacción que el cambio. Los
 * tipos y sus datos están en `contracts/events.ts`.
 */
@Injectable()
export class OutboxService {
  async enqueue<T extends DomainEventType>(tx: Tx, event: DomainEvent<T>): Promise<void> {
    await tx.insert(outboxEvents).values({ ...event, payload: event.payload as object });
  }
}
