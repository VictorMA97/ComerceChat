import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

const key = (jti: string) => `jwt:revoked:${jti}`;

/**
 * Lista de tokens revocados (cierre de sesión). Se guarda el `jti` hasta que el token caduca: a partir
 * de ahí ya no hace falta recordarlo.
 */
@Injectable()
export class TokenRevocationService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async revoke(jti: string, expiresAtSeconds: number): Promise<void> {
    const ttl = expiresAtSeconds - Math.floor(Date.now() / 1000);
    if (ttl > 0) await this.redis.set(key(jti), '1', 'EX', ttl);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(key(jti))) === 1;
  }
}

/** Emisor y audiencias de los JWT: un token de comensal nunca vale como token de comercio. */
export const JWT_ISSUER = 'comercechat-api';
export const MERCHANT_AUDIENCE = 'merchant';
export const USER_AUDIENCE = 'user';
