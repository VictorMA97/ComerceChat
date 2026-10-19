import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type ConnectionOptions, type JobsOptions, type Processor, Queue, Worker } from 'bullmq';
import { safeErrorForLog } from '../common/safe-error.js';
import { ENV, type Env } from '../config/env.js';

export const QueueName = {
  /** Webhooks del PSP ya guardados, pendientes de procesar. */
  PSP_EVENTS: 'psp-events',
  /** Eventos de dominio publicados desde el outbox. */
  DOMAIN_EVENTS: 'domain-events',
  /** Entrega de webhooks del PSP simulado (hace de sistema externo). */
  FAKE_PSP_WEBHOOKS: 'fake-psp-webhooks',
  /** Tareas periódicas (caducidad de sesiones de pago, relé del outbox). */
  MAINTENANCE: 'maintenance',
  /** Puntos PENDING → AVAILABLE. Cola propia: dos workers en la misma cola se reparten sus jobs. */
  LOYALTY: 'loyalty',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

interface WorkerRegistration {
  name: QueueName;
  processor: Processor;
  concurrency: number;
}

/**
 * Colas BullMQ (ADR-018: BullMQ en la PoC, SQS en el MVP). Los workers solo arrancan si
 * PROCESS_ROLE es `all` o `worker`; así el mismo código sirve para el proceso HTTP y el worker.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: ConnectionOptions;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly registrations: WorkerRegistration[] = [];
  private readonly workers: Worker[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    const url = new URL(env.REDIS_URL);
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  }

  get runsWorkers(): boolean {
    return this.env.PROCESS_ROLE !== 'http';
  }

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.connection,
        prefix: this.env.QUEUE_PREFIX,
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  add(name: QueueName, jobName: string, data: unknown, opts?: JobsOptions) {
    return this.queue(name).add(jobName, data, opts);
  }

  /** Registra un procesador. Se arranca en el bootstrap de la app si el rol lo permite. */
  registerWorker(name: QueueName, processor: Processor, concurrency = 4): void {
    this.registrations.push({ name, processor, concurrency });
  }

  onApplicationBootstrap(): void {
    if (!this.runsWorkers) return;
    for (const r of this.registrations) {
      const worker = new Worker(r.name, r.processor, {
        connection: this.connection,
        prefix: this.env.QUEUE_PREFIX,
        concurrency: r.concurrency,
      });
      worker.on('failed', (job, err) =>
        this.logger.warn(`Job ${r.name}/${job?.name} (${job?.id}) falló: ${safeErrorForLog(err)}`),
      );
      this.workers.push(worker);
    }
    this.logger.log(`Workers activos: ${this.registrations.map((r) => r.name).join(', ')}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
