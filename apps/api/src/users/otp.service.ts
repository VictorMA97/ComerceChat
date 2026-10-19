import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
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

const VALID = 1;
const BLOCKED = -1;

/**
 * Verificación atómica (Redis ejecuta el script sin intercalar otros comandos). El intento se cuenta
 * antes de comparar y el código se borra al acertar o al bloquear.
 * KEYS: código, intentos, bloqueo · ARGV: hash del código, máx. intentos, TTL intentos, TTL bloqueo.
 * Devuelve 1 (válido), 0 (no válido) o -1 (bloqueado).
 */
const VERIFY_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then return -1 end
local n = redis.call('INCR', KEYS[2])
if n == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
local stored = redis.call('GET', KEYS[1])
if stored and ARGV[1] ~= '' and stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
if n >= tonumber(ARGV[2]) then
  redis.call('SET', KEYS[3], '1', 'EX', ARGV[4])
  redis.call('DEL', KEYS[1], KEYS[2])
  return -1
end
return 0
`;

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

  /**
   * Comprueba el código. Tras 3 fallos bloquea el número 15 min. El código solo vale una vez.
   * Todo ocurre en un único script de Redis (`VERIFY_SCRIPT`): con peticiones en paralelo no hay más
   * de 3 comparaciones fallidas por código ni dos inicios de sesión con el mismo código.
   */
  async verify(phone: string, code: string): Promise<void> {
    const key = this.key(phone);
    const result = (await this.redis.eval(
      VERIFY_SCRIPT,
      3,
      key,
      `${key}:attempts`,
      `${key}:blocked`,
      // Un formato inválido cuenta como intento fallido, igual que un código erróneo.
      /^\d{6}$/.test(code) ? sha(code) : '',
      MAX_ATTEMPTS,
      TTL_SECONDS,
      BLOCK_SECONDS,
    )) as number;
    if (result === BLOCKED) throw this.blocked();
    if (result !== VALID) {
      throw new AppError(
        'OTP_INVALID',
        HttpStatus.UNAUTHORIZED,
        'El código no es correcto o ha caducado',
      );
    }
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
