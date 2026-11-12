import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { asc, inArray, isNull } from 'drizzle-orm';
import {
  type Consumer,
  type DomainEvents,
  type DomainEventType,
  domainEventsQueue,
  SUBSCRIPTIONS,
} from '../contracts/events.js';
import { safeErrorForLog } from '../common/safe-error.js';
import { DB, type Database } from '../db/client.js';
import { outboxEvents } from '../db/schema/platform.js';
import { QueueService } from '../queue/queue.service.js';
import type { NewJob } from '../queue/queue.types.js';

const RELAY_INTERVAL_MS = 300;
const BATCH = 100;

export interface DomainEventJob<T extends DomainEventType = DomainEventType> {
  outboxId: string;
  type: T;
  aggregate: string;
  aggregateId: string;
  payload: DomainEvents[T];
}

type Handler = (event: DomainEventJob) => Promise<void>;

/**
 * Publica los eventos del outbox (ARCHITECTURE §5) en la cola de cada contexto suscrito
 * (`SUBSCRIPTIONS`, ADR-029) y despacha cada cola a los manejadores de ese contexto. El jobId lleva
 * el evento y el consumidor: en BullMQ, publicar dos veces no duplica el trabajo; con SQS no hay
 * deduplicación y la garantía es que los manejadores sean idempotentes (ADR-026).
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly handlers = new Map<Consumer, Map<DomainEventType, Handler[]>>();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly queues: QueueService,
  ) {}

  /**
   * Suscribe un manejador de `consumer` a un tipo de evento. Debe figurar en `SUBSCRIPTIONS` y ser
   * idempotente: puede ejecutarse más de una vez. Llamar en `onModuleInit`.
   */
  on<T extends DomainEventType>(
    consumer: Consumer,
    type: T,
    handler: (event: DomainEventJob<T>) => Promise<void>,
  ): void {
    if (!SUBSCRIPTIONS[type].includes(consumer)) {
      throw new Error(`${consumer} no está suscrito a ${type}: añádelo en contracts/events.ts`);
    }
    let byType = this.handlers.get(consumer);
    if (!byType) {
      byType = new Map();
      this.handlers.set(consumer, byType);
      this.queues.registerWorker(domainEventsQueue(consumer), (job) =>
        this.dispatch(consumer, job.data as DomainEventJob),
      );
    }
    byType.set(type, [...(byType.get(type) ?? []), handler as Handler]);
  }

  onApplicationBootstrap(): void {
    if (!this.queues.runsWorkers) return;
    this.timer = setInterval(() => void this.relay(), RELAY_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Publica un lote de eventos pendientes. Público para los tests. */
  async relay(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.db.transaction(async (tx) => {
        const pending = await tx
          .select()
          .from(outboxEvents)
          .where(isNull(outboxEvents.publishedAt))
          .orderBy(asc(outboxEvents.createdAt))
          .limit(BATCH)
          .for('update', { skipLocked: true });
        if (pending.length === 0) return 0;
        const byQueue = new Map<Consumer, NewJob[]>();
        for (const e of pending) {
          const consumers = SUBSCRIPTIONS[e.type as DomainEventType];
          if (!consumers) {
            this.logger.error(`Evento ${e.id} de tipo desconocido (${e.type}): no se publica`);
            continue;
          }
          const data: DomainEventJob = {
            outboxId: e.id,
            type: e.type as DomainEventType,
            aggregate: e.aggregate,
            aggregateId: e.aggregateId,
            payload: e.payload as DomainEvents[DomainEventType],
          };
          for (const consumer of consumers) {
            byQueue.set(consumer, [
              ...(byQueue.get(consumer) ?? []),
              {
                name: e.type,
                data,
                opts: { jobId: `${e.id}-${consumer}`, attempts: 10, backoffMs: 2_000 },
                // El trabajo continúa la traza de quien creó el evento, no la del relé.
                trace: e.traceContext ?? undefined,
              },
            ]);
          }
        }
        for (const [consumer, jobs] of byQueue) {
          await this.queues.addBulk(domainEventsQueue(consumer), jobs);
        }
        await tx
          .update(outboxEvents)
          .set({ publishedAt: new Date() })
          .where(
            inArray(
              outboxEvents.id,
              pending.map((e) => e.id),
            ),
          );
        return pending.length;
      });
    } catch (err) {
      this.logger.error(`Error publicando el outbox: ${safeErrorForLog(err)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async dispatch(consumer: Consumer, event: DomainEventJob): Promise<void> {
    const handlers = this.handlers.get(consumer)?.get(event.type) ?? [];
    if (handlers.length === 0) {
      // Suscrito en el catálogo pero sin manejador en este proceso: se descarta con aviso.
      this.logger.warn(
        `${consumer} no tiene manejador para ${event.type} (evento ${event.outboxId})`,
      );
      return;
    }
    for (const handler of handlers) await handler(event);
  }
}
