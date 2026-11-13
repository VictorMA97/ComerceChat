import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { ENV, type Env } from '../config/base-env.js';
import { BullMqTransport } from './bullmq.transport.js';
import {
  type EnqueueOptions,
  type JobProcessor,
  type NewJob,
  QueueName,
  type QueueTransport,
  SCHEDULED_QUEUES,
  type WorkerRegistration,
} from './queue.types.js';
import { SqsTransport } from './sqs.transport.js';
import { contextFrom, traceCarrier } from './trace-context.js';

const tracer = trace.getTracer('comercechat-queue');

/**
 * Cada trabajo abre su propio span (ADR-027), hijo del contexto de quien lo encoló si el mensaje lo
 * trae: así una petición y los trabajos que provoca (webhook → captura → eventos → caja) forman una
 * sola traza. Sin TELEMETRY=on, la API de OpenTelemetry no hace nada.
 */
export function traced(queue: QueueName, driver: string, processor: JobProcessor): JobProcessor {
  return (job) =>
    tracer.startActiveSpan(
      `process ${queue} ${job.name}`,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': driver === 'sqs' ? 'aws_sqs' : 'bullmq',
          'messaging.destination.name': queue,
          'messaging.operation.type': 'process',
          'messaging.message.delivery_attempt': job.attemptsMade + 1,
        },
      },
      contextFrom(job.trace) ?? context.active(),
      async (span) => {
        try {
          return await processor(job);
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          span.end();
        }
      },
    );
}

/**
 * Colas de trabajo (ADR-018, ADR-026). `QUEUE_DRIVER` elige el transporte de las colas de trabajo:
 * BullMQ sobre Redis en la PoC o SQS en el MVP. Las tareas periódicas van siempre en BullMQ.
 * Los workers solo arrancan si PROCESS_ROLE es `all` o `worker`: el mismo código sirve para el
 * proceso HTTP y para el worker.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private readonly bullmq: BullMqTransport;
  private readonly work: QueueTransport;
  private readonly registrations: WorkerRegistration[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.bullmq = new BullMqTransport(env.REDIS_URL, env.QUEUE_PREFIX);
    this.work =
      env.QUEUE_DRIVER === 'sqs'
        ? new SqsTransport({
            region: env.AWS_REGION,
            endpoint: env.SQS_ENDPOINT,
            prefix: env.QUEUE_PREFIX,
            createQueues: env.SQS_CREATE_QUEUES === 'on',
            waitSeconds: env.SQS_WAIT_SECONDS,
          })
        : this.bullmq;
  }

  get runsWorkers(): boolean {
    return this.env.PROCESS_ROLE !== 'http';
  }

  private transport(name: QueueName): QueueTransport {
    return SCHEDULED_QUEUES.has(name) ? this.bullmq : this.work;
  }

  add(name: QueueName, jobName: string, data: unknown, opts?: EnqueueOptions): Promise<void> {
    return this.transport(name).add(name, { name: jobName, data, opts, trace: traceCarrier() });
  }

  addBulk(name: QueueName, jobs: NewJob[]): Promise<void> {
    if (jobs.length === 0) return Promise.resolve();
    const current = traceCarrier();
    return this.transport(name).addBulk(
      name,
      jobs.map((j) => ({ ...j, trace: j.trace ?? current })),
    );
  }

  /** Tarea periódica (solo colas de `SCHEDULED_QUEUES`). Llamar en el bootstrap si `runsWorkers`. */
  schedule(name: QueueName, jobName: string, everyMs: number): Promise<void> {
    if (!SCHEDULED_QUEUES.has(name)) throw new Error(`${name} no es una cola de tareas periódicas`);
    return this.bullmq.schedule(name, jobName, everyMs);
  }

  /** Registra un procesador. Se arranca en el bootstrap de la app si el rol lo permite. */
  registerWorker(name: QueueName, processor: JobProcessor, concurrency = 4): void {
    const driver = SCHEDULED_QUEUES.has(name) ? 'bullmq' : this.env.QUEUE_DRIVER;
    this.registrations.push({ name, processor: traced(name, driver, processor), concurrency });
  }

  onApplicationBootstrap(): void {
    if (!this.runsWorkers) return;
    for (const r of this.registrations) this.transport(r.name).startWorker(r);
    this.logger.log(
      `Workers activos (${this.env.QUEUE_DRIVER}): ${this.registrations.map((r) => r.name).join(', ')}`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.work.close(),
      this.work === this.bullmq ? Promise.resolve() : this.bullmq.close(),
    ]);
  }
}
