import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { AppError } from '../common/app-error.js';
import { hashPii } from '../common/pii.js';
import { ENV, type Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { OTP_SENDER, type OtpSender } from './otp-sender.js';

const TTL_SECONDS = 300;
const MAX_ATTEMPTS = 3;
const BLOCK_SECONDS = 15 * 60;
const MAX_SENDS_PER_HOUR = 5;
/** Número de demostración (solo fuera de producción): su código siempre es 000000 (ARCHITECTURE §16.3). */
const DEMO_PHONE = '+34600000000';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

/** Códigos de un solo uso por teléfono (FR-USR-02). Se guarda solo el hash del código, en Redis. */
@Injectable()
export class OtpService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async start(phone: string): Promise<{ expiresInSeconds: number }> {
    const key = this.key(phone);
    if (await this.redis.exists(`${key}:blocked`)) throw this.blocked();
    const isDemo = this.env.NODE_ENV !== 'production' && phone === DEMO_PHONE;
    // El número de demo se usa en cada demo y en el E2E: sin límite de envíos (nunca en producción).
    const sends = isDemo ? 1 : await this.redis.incr(`${key}:sends`);
    if (sends === 1) await this.redis.expire(`${key}:sends`, 3600);
    if (sends > MAX_SENDS_PER_HOUR) {
      throw new AppError(
        'OTP_TOO_MANY',
        HttpStatus.TOO_MANY_REQUESTS,
        'Has pedido demasiados códigos. Espera un rato.',
      );
    }
    const code = isDemo ? '000000' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis.multi().set(key, sha(code), 'EX', TTL_SECONDS).del(`${key}:attempts`).exec();
    await this.sender.send(phone, code);
    return { expiresInSeconds: TTL_SECONDS };
  }

  /** Comprueba el código. Tras 3 fallos bloquea el número 15 min. El código solo vale una vez. */
  async verify(phone: string, code: string): Promise<void> {
    const key = this.key(phone);
    if (await this.redis.exists(`${key}:blocked`)) throw this.blocked();
    const stored = await this.redis.get(key);
    const ok =
      stored !== null &&
      /^\d{6}$/.test(code) &&
      timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(sha(code), 'hex'));
    if (!ok) {
      const attempts = await this.redis.incr(`${key}:attempts`);
      await this.redis.expire(`${key}:attempts`, TTL_SECONDS);
      if (attempts >= MAX_ATTEMPTS) {
        await this.redis.multi().set(`${key}:blocked`, '1', 'EX', BLOCK_SECONDS).del(key).exec();
        throw this.blocked();
      }
      throw new AppError(
        'OTP_INVALID',
        HttpStatus.UNAUTHORIZED,
        'El código no es correcto o ha caducado',
      );
    }
    await this.redis.del(key, `${key}:attempts`);
  }

  private key(phone: string): string {
    return `otp:${hashPii(phone, this.env.PII_ENCRYPTION_KEY)}`;
  }

  private blocked(): AppError {
    return new AppError(
      'OTP_BLOCKED',
      HttpStatus.TOO_MANY_REQUESTS,
      'Demasiados intentos. Vuelve a intentarlo en 15 minutos.',
    );
  }
}
