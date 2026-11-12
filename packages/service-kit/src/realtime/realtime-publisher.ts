import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import type { RealtimeEvent } from '@comercechat/shared-types';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

/** Canal de Redis por local (ARCHITECTURE §12): `rt:location:<locationId>`. */
export const REALTIME_CHANNEL_PREFIX = 'rt:location:';

/**
 * Publica avisos de tiempo real tras un cambio (ARCHITECTURE §12). Cualquier servicio publica; el
 * servicio realtime los reparte a las conexiones SSE. El aviso solo dice qué ha cambiado: el cliente
 * vuelve a pedir los datos. Llamar después del commit.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Nunca falla hacia fuera: el tiempo real no debe romper un pago. */
  async publish(event: Omit<RealtimeEvent, 'at'>): Promise<void> {
    const payload: RealtimeEvent = { ...event, at: new Date().toISOString() };
    await this.redis
      .publish(`${REALTIME_CHANNEL_PREFIX}${event.locationId}`, JSON.stringify(payload))
      .catch((err: unknown) =>
        this.logger.warn(`No se pudo publicar en tiempo real: ${String(err)}`),
      );
  }

  publishTable(
    locationId: string,
    tableId: string | null | undefined,
    reason: string,
  ): Promise<void> {
    return this.publish({
      type: 'table.updated',
      locationId,
      tableId: tableId ?? undefined,
      reason,
    });
  }
}

@Global()
@Module({ providers: [RealtimePublisher], exports: [RealtimePublisher] })
export class RealtimePublisherModule {}
