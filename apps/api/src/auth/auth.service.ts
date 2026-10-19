import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@comercechat/shared-types';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { newId } from '../common/ids.js';
import { hashPii } from '../common/pii.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Database } from '../db/client.js';
import { merchantUsers } from '../db/schema/index.js';
import { REDIS } from '../redis/redis.module.js';
import {
  MERCHANT_AUTH_PROVIDER,
  type MerchantAuthProvider,
  type MerchantPrincipal,
} from './auth.types.js';
import {
  JWT_ISSUER,
  MERCHANT_AUDIENCE,
  TokenRevocationService,
} from './token-revocation.service.js';

/** Fallos seguidos de una misma cuenta antes de bloquear su inicio de sesión (por email, no por IP). */
const MAX_LOGIN_FAILURES = 10;
const LOGIN_LOCK_SECONDS = 15 * 60;

interface MerchantJwtPayload {
  sub: string;
  mid: string;
  role: MerchantPrincipal['role'];
  typ: 'merchant';
  jti: string;
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(MERCHANT_AUTH_PROVIDER) private readonly provider: MerchantAuthProvider,
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly revocations: TokenRevocationService,
  ) {}

  async loginMerchant(email: string, password: string, ip?: string): Promise<LoginResponse> {
    // El email no se guarda en claro ni en Redis ni en la auditoría.
    const emailHash = hashPii(email, this.env.PII_ENCRYPTION_KEY);
    const failuresKey = `login:failures:${emailHash}`;
    const failures = Number((await this.redis.get(failuresKey)) ?? 0);
    if (failures >= MAX_LOGIN_FAILURES) {
      throw new AppError(
        'LOGIN_LOCKED',
        HttpStatus.TOO_MANY_REQUESTS,
        'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.',
      );
    }

    const principal = await this.provider.authenticate(email, password);
    if (!principal) {
      await this.redis.multi().incr(failuresKey).expire(failuresKey, LOGIN_LOCK_SECONDS).exec();
      await this.audit.record({
        actorType: 'MERCHANT_USER',
        action: 'merchant_user.login_failed',
        entity: 'merchant_user',
        after: { emailHash },
        ip,
      });
      throw new AppError(
        'INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
        'Email o contraseña incorrectos',
      );
    }
    await this.redis.del(failuresKey);
    const payload: Omit<MerchantJwtPayload, 'jti' | 'exp'> = {
      sub: principal.merchantUserId,
      mid: principal.merchantId,
      role: principal.role,
      typ: 'merchant',
    };
    const expiresIn = this.env.JWT_MERCHANT_TTL_SECONDS;
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn,
      issuer: JWT_ISSUER,
      audience: MERCHANT_AUDIENCE,
      jwtid: newId(),
    });
    await this.audit.record({
      actorType: 'MERCHANT_USER',
      actorId: principal.merchantUserId,
      action: 'merchant_user.login',
      entity: 'merchant_user',
      entityId: principal.merchantUserId,
      ip,
    });
    return { accessToken, expiresIn };
  }

  /**
   * Valida el token y devuelve la identidad ACTUAL del usuario: rol, comercio y estado se leen de la
   * base de datos, así que una baja o un cambio de rol se aplican sin esperar a que caduque el token.
   */
  async verifyMerchantToken(token: string): Promise<MerchantPrincipal | null> {
    const p = await this.decode(token);
    if (!p || (await this.revocations.isRevoked(p.jti))) return null;
    const user = await this.db.query.merchantUsers.findFirst({
      where: eq(merchantUsers.id, p.sub),
    });
    if (!user || user.status !== 'ACTIVE' || user.merchantId !== p.mid) return null;
    return { merchantUserId: user.id, merchantId: user.merchantId, role: user.role };
  }

  /** Cierre de sesión: el token deja de valer aunque no haya caducado. */
  async revokeMerchantToken(token: string): Promise<void> {
    const p = await this.decode(token);
    if (p) await this.revocations.revoke(p.jti, p.exp);
  }

  private async decode(token: string): Promise<MerchantJwtPayload | null> {
    try {
      const p = await this.jwt.verifyAsync<MerchantJwtPayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: MERCHANT_AUDIENCE,
      });
      return p.typ === 'merchant' && typeof p.jti === 'string' ? p : null;
    } catch {
      return null;
    }
  }
}
