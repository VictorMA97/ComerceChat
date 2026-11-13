import { Injectable } from '@nestjs/common';
import type { DomainEvents, DomainEventType } from '@comercechat/contracts';
import type { Database } from '../db/database.js';
import { outboxEvents } from '../db/platform.js';
import { traceCarrier } from '../queue/trace-context.js';

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
  /** `tx`: la transacción del cambio. Sin cambio que acompañar, vale la conexión directa. */
  async enqueue<T extends DomainEventType>(
    tx: Pick<Database, 'insert'>,
    event: DomainEvent<T>,
  ): Promise<void> {
    await tx
      .insert(outboxEvents)
      .values({ ...event, payload: event.payload as object, traceContext: traceCarrier() ?? null });
  }
}
