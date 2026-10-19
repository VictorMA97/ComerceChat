import {
  ChangeMessageVisibilityCommand,
  CreateQueueCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  type Message,
  QueueDoesNotExist,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Logger } from '@nestjs/common';
import { safeErrorForLog } from '../common/safe-error.js';
import type { NewJob, QueueName, QueueTransport, WorkerRegistration } from './queue.types.js';

/** Tiempo que un mensaje recibido queda oculto a otros consumidores mientras se procesa. */
const VISIBILITY_TIMEOUT_SECONDS = 60;
/** Red de seguridad de la DLQ por si el proceso muere antes de mover el mensaje él mismo. */
const MAX_RECEIVE_COUNT = 25;
const MAX_VISIBILITY_SECONDS = 12 * 60 * 60;
const MAX_DELAY_SECONDS = 15 * 60;

interface Envelope {
  name: string;
  data: unknown;
  attempts: number;
  backoffMs: number;
}

export interface SqsTransportOptions {
  region: string;
  endpoint?: string;
  /** Prefijo de los nombres de cola (`QUEUE_PREFIX`): `<prefijo>-<cola>` y `<prefijo>-<cola>-dlq`. */
  prefix: string;
  createQueues: boolean;
  waitSeconds: number;
}

/**
 * Colas en Amazon SQS (ADR-026) o en un servicio compatible en local (ElasticMQ). Colas estándar:
 * entrega «al menos una vez» y sin orden; los procesadores son idempotentes.
 *
 * Reintentos: el mensaje fallido se vuelve a ver tras `backoffMs · 2^(n-1)` (cambiando su
 * visibilidad). Al agotar `attempts` se copia a la DLQ y se borra de la cola.
 */
export class SqsTransport implements QueueTransport {
  private readonly logger = new Logger(SqsTransport.name);
  private readonly client: SQSClient;
  private readonly urls = new Map<string, Promise<string>>();
  private readonly abort = new AbortController();
  private readonly loops: Promise<void>[] = [];

  constructor(private readonly opts: SqsTransportOptions) {
    const local = Boolean(opts.endpoint) && !process.env.AWS_ACCESS_KEY_ID;
    this.client = new SQSClient({
      region: opts.region,
      endpoint: opts.endpoint,
      // ElasticMQ no comprueba credenciales, pero el SDK las exige para firmar.
      credentials: local ? { accessKeyId: 'local', secretAccessKey: 'local' } : undefined,
    });
  }

  queueName(queue: QueueName, dlq = false): string {
    return `${this.opts.prefix}-${queue}${dlq ? '-dlq' : ''}`;
  }

  async add(queue: QueueName, job: NewJob): Promise<void> {
    const { body, delay } = this.serialize(job);
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: await this.url(queue),
        MessageBody: body,
        DelaySeconds: delay,
      }),
    );
  }

  async addBulk(queue: QueueName, jobs: NewJob[]): Promise<void> {
    const url = await this.url(queue);
    for (let i = 0; i < jobs.length; i += 10) {
      const chunk = jobs.slice(i, i + 10);
      const res = await this.client.send(
        new SendMessageBatchCommand({
          QueueUrl: url,
          Entries: chunk.map((job, j) => {
            const { body, delay } = this.serialize(job);
            return { Id: String(j), MessageBody: body, DelaySeconds: delay };
          }),
        }),
      );
      // Un envío parcial se considera fallido: quien llama reintenta el lote entero (idempotente).
      if (res.Failed?.length) {
        throw new Error(
          `SQS rechazó ${res.Failed.length} mensajes en ${queue}: ${res.Failed[0]!.Code}`,
        );
      }
    }
  }

  startWorker(reg: WorkerRegistration): void {
    this.loops.push(this.poll(reg));
  }

  async close(): Promise<void> {
    this.abort.abort();
    await Promise.all(this.loops);
    this.client.destroy();
  }

  private serialize(job: NewJob): { body: string; delay: number | undefined } {
    const envelope: Envelope = {
      name: job.name,
      data: job.data,
      attempts: Math.max(1, job.opts?.attempts ?? 1),
      backoffMs: job.opts?.backoffMs ?? 1_000,
    };
    const delayMs = job.opts?.delayMs ?? 0;
    return {
      body: JSON.stringify(envelope),
      delay: delayMs > 0 ? Math.min(MAX_DELAY_SECONDS, Math.ceil(delayMs / 1000)) : undefined,
    };
  }

  private async poll(reg: WorkerRegistration): Promise<void> {
    const signal = this.abort.signal;
    let url: string;
    try {
      url = await this.url(reg.name);
    } catch (err) {
      this.logger.error(`No se puede consumir ${reg.name}: ${safeErrorForLog(err)}`);
      return;
    }
    while (!signal.aborted) {
      let messages: Message[];
      try {
        const res = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: url,
            MaxNumberOfMessages: Math.min(10, Math.max(1, reg.concurrency)),
            WaitTimeSeconds: this.opts.waitSeconds,
            VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
          }),
          { abortSignal: signal },
        );
        messages = res.Messages ?? [];
      } catch (err) {
        if (signal.aborted) return;
        this.logger.warn(`Error recibiendo de ${reg.name}: ${safeErrorForLog(err)}`);
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      await Promise.all(messages.map((m) => this.handle(reg, url, m)));
    }
  }

  private async handle(reg: WorkerRegistration, url: string, m: Message): Promise<void> {
    const receiveCount = Number(m.Attributes?.ApproximateReceiveCount ?? 1);
    let envelope: Envelope;
    try {
      envelope = JSON.parse(m.Body ?? '') as Envelope;
    } catch {
      this.logger.error(`Mensaje ilegible en ${reg.name} (${m.MessageId}): a la DLQ`);
      await this.toDlq(reg.name, url, m, 'mensaje ilegible');
      return;
    }
    try {
      await reg.processor({
        name: envelope.name,
        data: envelope.data,
        attemptsMade: receiveCount - 1,
      });
      await this.client.send(
        new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: m.ReceiptHandle }),
      );
    } catch (err) {
      const reason = safeErrorForLog(err);
      if (receiveCount >= envelope.attempts) {
        this.logger.error(
          `Job ${reg.name}/${envelope.name} agotó ${envelope.attempts} intentos: ${reason}`,
        );
        await this.toDlq(reg.name, url, m, reason);
        return;
      }
      this.logger.warn(
        `Job ${reg.name}/${envelope.name} falló (intento ${receiveCount}/${envelope.attempts}): ${reason}`,
      );
      const backoff = Math.ceil((envelope.backoffMs * 2 ** (receiveCount - 1)) / 1000);
      await this.client
        .send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: url,
            ReceiptHandle: m.ReceiptHandle,
            VisibilityTimeout: Math.min(MAX_VISIBILITY_SECONDS, Math.max(1, backoff)),
          }),
        )
        .catch((e: unknown) =>
          // Sin cambiar la visibilidad, el mensaje reaparece al caducar la actual: también vale.
          this.logger.warn(`No se pudo aplazar el reintento: ${safeErrorForLog(e)}`),
        );
    }
  }

  private async toDlq(queue: QueueName, url: string, m: Message, reason: string): Promise<void> {
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: await this.url(queue, true),
          MessageBody: m.Body ?? '',
          MessageAttributes: {
            failureReason: { DataType: 'String', StringValue: reason.slice(0, 1000) },
          },
        }),
      );
      await this.client.send(
        new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: m.ReceiptHandle }),
      );
    } catch (err) {
      // Si no se puede mover, la redrive policy de la cola lo llevará a la DLQ igualmente.
      this.logger.error(`No se pudo mover a la DLQ de ${queue}: ${safeErrorForLog(err)}`);
    }
  }

  /** URL de la cola, creándola (con su DLQ) en local si falta. */
  private url(queue: QueueName, dlq = false): Promise<string> {
    const name = this.queueName(queue, dlq);
    let url = this.urls.get(name);
    if (!url) {
      url = this.resolve(queue, dlq).catch((err: unknown) => {
        this.urls.delete(name);
        throw err;
      });
      this.urls.set(name, url);
    }
    return url;
  }

  private async resolve(queue: QueueName, dlq: boolean): Promise<string> {
    const name = this.queueName(queue, dlq);
    try {
      const res = await this.client.send(new GetQueueUrlCommand({ QueueName: name }));
      return res.QueueUrl!;
    } catch (err) {
      if (!(err instanceof QueueDoesNotExist) || !this.opts.createQueues) throw err;
    }
    const attributes: Record<string, string> = {
      VisibilityTimeout: String(VISIBILITY_TIMEOUT_SECONDS),
      MessageRetentionPeriod: String(14 * 24 * 60 * 60),
    };
    if (!dlq) {
      const dlqUrl = await this.url(queue, true);
      const arn = await this.arnOf(dlqUrl, this.queueName(queue, true));
      attributes.RedrivePolicy = JSON.stringify({
        deadLetterTargetArn: arn,
        maxReceiveCount: MAX_RECEIVE_COUNT,
      });
    }
    const res = await this.client.send(
      new CreateQueueCommand({ QueueName: name, Attributes: attributes }),
    );
    this.logger.log(`Cola SQS creada: ${name}`);
    return res.QueueUrl!;
  }

  private async arnOf(url: string, name: string): Promise<string> {
    const res = await this.client.send(
      new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['QueueArn'] }),
    );
    return res.Attributes?.QueueArn ?? `arn:aws:sqs:${this.opts.region}:000000000000:${name}`;
  }
}
