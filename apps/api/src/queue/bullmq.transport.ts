import { Logger } from '@nestjs/common';
import { type ConnectionOptions, type JobsOptions, Queue, Worker } from 'bullmq';
import { safeErrorForLog } from '../common/safe-error.js';
import type { NewJob, QueueName, QueueTransport, WorkerRegistration } from './queue.types.js';
import type { TraceCarrier } from './trace-context.js';

/**
 * Lo que se guarda en BullMQ: los datos del trabajo y su contexto de traza. Los trabajos de las
 * tareas periódicas no llevan datos; los encolados antes de este formato tampoco llevan `cc`.
 */
interface StoredJob {
  cc: 1;
  data: unknown;
  trace?: TraceCarrier;
}
const store = (j: NewJob): StoredJob => ({ cc: 1, data: j.data, trace: j.trace });
const unwrap = (raw: unknown): { data: unknown; trace?: TraceCarrier } =>
  raw && typeof raw === 'object' && (raw as StoredJob).cc === 1
    ? (raw as StoredJob)
    : { data: raw };

const toBullOptions = (opts: NewJob['opts'] = {}): JobsOptions => ({
  jobId: opts.jobId,
  attempts: opts.attempts,
  backoff: opts.backoffMs ? { type: 'exponential', delay: opts.backoffMs } : undefined,
  delay: opts.delayMs,
});

/** Colas BullMQ sobre Redis: la PoC y las tareas periódicas en cualquier entorno. */
export class BullMqTransport implements QueueTransport {
  private readonly logger = new Logger(BullMqTransport.name);
  private readonly connection: ConnectionOptions;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    redisUrl: string,
    private readonly prefix: string,
  ) {
    const url = new URL(redisUrl);
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  }

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.connection,
        prefix: this.prefix,
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  async add(queue: QueueName, job: NewJob): Promise<void> {
    await this.queue(queue).add(job.name, store(job), toBullOptions(job.opts));
  }

  async addBulk(queue: QueueName, jobs: NewJob[]): Promise<void> {
    await this.queue(queue).addBulk(
      jobs.map((j) => ({ name: j.name, data: store(j), opts: toBullOptions(j.opts) })),
    );
  }

  /** Tarea periódica: un solo programador por id aunque haya varios procesos. */
  async schedule(queue: QueueName, jobName: string, everyMs: number): Promise<void> {
    await this.queue(queue).upsertJobScheduler(jobName, { every: everyMs }, { name: jobName });
  }

  startWorker(r: WorkerRegistration): void {
    const worker = new Worker(
      r.name,
      (job) => {
        const { data, trace } = unwrap(job.data);
        return r.processor({ name: job.name, data, attemptsMade: job.attemptsMade, trace });
      },
      {
        connection: this.connection,
        prefix: this.prefix,
        concurrency: r.concurrency,
      },
    );
    worker.on('failed', (job, err) =>
      this.logger.warn(`Job ${r.name}/${job?.name} (${job?.id}) falló: ${safeErrorForLog(err)}`),
    );
    this.workers.push(worker);
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
