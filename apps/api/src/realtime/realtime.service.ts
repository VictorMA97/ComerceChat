import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { RealtimeEvent } from '@comercechat/shared-types';
import { EventEmitter } from 'node:events';
import type { Redis } from 'ioredis';
import { REALTIME_CHANNEL_PREFIX, REDIS } from '@comercechat/service-kit';
import { filter, fromEvent, interval, map, merge, type Observable, startWith } from 'rxjs';

/** Comentario SSE periódico: evita que proxies y túneles corten la conexión por inactividad. */
const HEARTBEAT_MS = 15_000;

/**
 * Tiempo real (ARCHITECTURE §12): cualquier servicio publica en Redis con `RealtimePublisher`
 * (service-kit) y este reparte los avisos de cada local a sus conexiones SSE. El evento solo avisa;
 * el cliente vuelve a pedir los datos.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly local = new EventEmitter();
  private subscriber?: Redis;

  constructor(@Inject(REDIS) private readonly redis: Redis) {
    this.local.setMaxListeners(0);
  }

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('pmessage', (_pattern: string, _channel: string, message: string) => {
      try {
        this.local.emit('event', JSON.parse(message) as RealtimeEvent);
      } catch (err) {
        this.logger.warn(`Evento de tiempo real inválido: ${String(err)}`);
      }
    });
    await this.subscriber.psubscribe(`${REALTIME_CHANNEL_PREFIX}*`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  /**
   * Flujo SSE con los eventos que cumplen `predicate` y un latido periódico. Empieza con `ready`: si el
   * cliente no lo recibe, hay un proxy reteniendo el flujo (p. ej. el túnel rápido de Cloudflare, que
   * no admite SSE) y debe pasar a sondeo.
   */
  stream(predicate: (e: RealtimeEvent) => boolean): Observable<MessageEvent> {
    const events = fromEvent(this.local, 'event').pipe(
      map((e) => e as RealtimeEvent),
      filter(predicate),
      map((e): MessageEvent => ({ type: e.type, data: e })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(events, heartbeat).pipe(startWith<MessageEvent>({ type: 'ready', data: '' }));
  }
}
