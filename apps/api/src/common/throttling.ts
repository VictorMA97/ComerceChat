import { HttpStatus, Inject, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { AppError } from './app-error.js';
import { clientIp } from './client-ip.js';

/**
 * Ventana fija por clave en Redis, compartida por todos los procesos de la API. Script atómico: suma
 * el acceso y, si supera el límite, bloquea la clave `blockDuration` ms.
 * KEYS: contador, bloqueo · ARGV: ventana (ms), límite, bloqueo (ms).
 * Devuelve [accesos, ms hasta que caduca la ventana, bloqueada (0/1), ms hasta que caduca el bloqueo].
 */
const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  return { tonumber(ARGV[2]) + 1, blockedTtl, 1, blockedTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, ttl, 1, tonumber(ARGV[3]) }
end
return { hits, ttl, 0, 0 }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  /** `prefix`: el de las colas (`QUEUE_PREFIX`), para que los tests no compartan contadores con `pnpm dev`. */
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    const base = `${this.prefix}:throttle:${throttlerName}:${key}`;
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      base,
      `${base}:blocked`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number];
    return {
      totalHits,
      // La librería trabaja en segundos.
      timeToExpire: Math.max(0, Math.ceil(timeToExpire / 1000)),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(timeToBlockExpire / 1000)),
    };
  }
}

/** Limita por la IP real del cliente (ver `clientIp`), no por la del servidor de Next. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  @Inject(ENV) private readonly env!: Env;

  protected override shouldSkip(): Promise<boolean> {
    return Promise.resolve(this.env.RATE_LIMITS === 'off');
  }

  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIp(req as unknown as Request, this.env.INTERNAL_PROXY_SECRET));
  }

  protected override throwThrottlingException(): Promise<void> {
    throw new AppError(
      'RATE_LIMITED',
      HttpStatus.TOO_MANY_REQUESTS,
      'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.',
    );
  }
}

const MINUTE = 60_000;

/**
 * Límites de los endpoints sensibles (CLAUDE.md, «Rate Limiting»), por IP del cliente. Se aplican
 * con `@Throttle({ default: RATE_LIMITS.x })`; el límite general protege el resto.
 */
export const RATE_LIMITS = {
  merchantLogin: { limit: 10, ttl: 15 * MINUTE, blockDuration: 15 * MINUTE },
  // Holgado para las demos con el número de pruebas; el límite por teléfono está en OtpService.
  otpStart: { limit: 10, ttl: 10 * MINUTE, blockDuration: 30 * MINUTE },
  otpVerify: { limit: 10, ttl: MINUTE, blockDuration: 15 * MINUTE },
  paymentSession: { limit: 20, ttl: MINUTE },
  redeem: { limit: 20, ttl: MINUTE },
} as const;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [REDIS, ENV],
      useFactory: (redis: Redis, env: Env) => ({
        throttlers: [{ name: 'default', ttl: MINUTE, limit: 300 }],
        storage: new RedisThrottlerStorage(redis, env.QUEUE_PREFIX),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }],
})
export class ThrottlingModule {}
