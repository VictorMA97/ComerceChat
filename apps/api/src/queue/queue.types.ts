import { CONSUMERS, type Consumer, domainEventsQueue } from '@comercechat/contracts';
import type { TraceCarrier } from './trace-context.js';

export const QueueName = {
  /** Webhooks del PSP ya guardados, pendientes de procesar. */
  PSP_EVENTS: 'psp-events',
  /** Entrega de webhooks del PSP simulado (hace de sistema externo). */
  FAKE_PSP_WEBHOOKS: 'fake-psp-webhooks',
  /** Tareas periódicas (caducidad de sesiones de pago, purga de claves de idempotencia). */
  MAINTENANCE: 'maintenance',
  /** Puntos PENDING → AVAILABLE. Cola propia: dos workers en la misma cola se reparten sus jobs. */
  LOYALTY: 'loyalty',
} as const;
/** Eventos de dominio publicados desde el outbox: una cola por contexto consumidor (ADR-029). */
export type DomainEventsQueue = ReturnType<typeof domainEventsQueue>;
export const DOMAIN_EVENT_QUEUES: readonly DomainEventsQueue[] = CONSUMERS.map(domainEventsQueue);
export type { Consumer };

export type QueueName = (typeof QueueName)[keyof typeof QueueName] | DomainEventsQueue;

/**
 * Colas de tareas periódicas: van siempre en BullMQ, con cualquier `QUEUE_DRIVER`. SQS no programa
 * tareas; en AWS el equivalente sería EventBridge Scheduler, que no aporta nada mientras haya Redis.
 */
export const SCHEDULED_QUEUES: ReadonlySet<QueueName> = new Set([
  QueueName.MAINTENANCE,
  QueueName.LOYALTY,
]);

/** Trabajo entregado a un procesador, sea cual sea el transporte. */
export interface QueueJob {
  name: string;
  data: unknown;
  /** Intentos fallidos anteriores a este. */
  attemptsMade: number;
  /** Contexto de traza de quien lo encoló: el span del trabajo es su hijo (ADR-027). */
  trace?: TraceCarrier;
}

export type JobProcessor = (job: QueueJob) => Promise<unknown>;

export interface EnqueueOptions {
  /**
   * Deduplica en BullMQ (mismo id = un solo job). SQS estándar no deduplica: la garantía real es que
   * todo procesador sea idempotente (CLAUDE.md).
   */
  jobId?: string;
  /** Intentos totales antes de dar el trabajo por fallido (por defecto, 1). */
  attempts?: number;
  /** Espera antes del primer reintento; se dobla en cada uno. */
  backoffMs?: number;
  /** Retraso antes de la primera entrega (SQS admite hasta 15 min). */
  delayMs?: number;
}

export interface NewJob {
  name: string;
  data: unknown;
  opts?: EnqueueOptions;
  /** Si no se indica, `QueueService` usa el contexto de traza activo al encolar. */
  trace?: TraceCarrier;
}

export interface WorkerRegistration {
  name: QueueName;
  processor: JobProcessor;
  concurrency: number;
}

/** Transporte de colas de trabajo: BullMQ (Redis) o SQS (ADR-026). */
export interface QueueTransport {
  add(queue: QueueName, job: NewJob): Promise<void>;
  addBulk(queue: QueueName, jobs: NewJob[]): Promise<void>;
  startWorker(reg: WorkerRegistration): void;
  close(): Promise<void>;
}
