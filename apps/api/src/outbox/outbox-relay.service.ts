import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { asc, inArray, isNull } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { outboxEvents } from '../db/schema/index.js';
import { QueueName, QueueService } from '../queue/queue.service.js';

const RELAY_INTERVAL_MS = 300;
const BATCH = 100;

export interface DomainEventJob {
  outboxId: string;
  type: string;
  aggregate: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

type Handler = (event: DomainEventJob) => Promise<void>;

/**
 * Publica los eventos del outbox en la cola `domain-events` y los despacha a sus manejadores
 * (ARCHITECTURE §5). El jobId es el id del evento: publicar dos veces no duplica el trabajo.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly handlers = new Map<string, Handler[]>();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly queues: QueueService,
  ) {
    this.queues.registerWorker(QueueName.DOMAIN_EVENTS, async (job) => {
      const event = job.data as DomainEventJob;
      for (const handler of this.handlers.get(event.type) ?? []) await handler(event);
    });
  }

  /** Suscribe un manejador a un tipo de evento. Debe ser idempotente: puede ejecutarse más de una vez. */
  on(type: string, handler: Handler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
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
        await this.queues.queue(QueueName.DOMAIN_EVENTS).addBulk(
          pending.map((e) => ({
            name: e.type,
            data: {
              outboxId: e.id,
              type: e.type,
              aggregate: e.aggregate,
              aggregateId: e.aggregateId,
              payload: e.payload as Record<string, unknown>,
            } satisfies DomainEventJob,
            opts: { jobId: e.id, attempts: 10, backoff: { type: 'exponential', delay: 2_000 } },
          })),
        );
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
      this.logger.error(`Error publicando el outbox: ${String(err)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
