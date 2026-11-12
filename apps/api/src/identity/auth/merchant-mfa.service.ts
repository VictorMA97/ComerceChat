import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MfaSetupResponse } from '@comercechat/shared-types';
import { and, eq, isNull } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../audit/audit.service.js';
import { AppError } from '../../common/app-error.js';
import { newId } from '../../common/ids.js';
import { decryptPii, encryptPii, hashPii } from '../../common/pii.js';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/client.js';
import { merchantUserRecoveryCodes, merchantUsers } from '../../db/schema/index.js';
import { REDIS } from '../../redis/redis.module.js';
import type { MerchantPrincipal } from './auth.types.js';
import { base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from './totp.js';
import { JWT_ISSUER, TokenRevocationService } from './token-revocation.service.js';

/** Audiencia del token intermedio: entre la contraseña y el segundo factor no es una sesión. */
export const MERCHANT_MFA_AUDIENCE = 'merchant-mfa';
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const PENDING_SECRET_TTL_SECONDS = 10 * 60;
const MAX_MFA_FAILURES = 5;
const MFA_LOCK_SECONDS = 15 * 60;
const RECOVERY_CODES = 10;

export type MfaStage = 'verify' | 'setup';

type MfaUser = { id: string; merchantId: string };

interface MfaChallengePayload {
  sub: string;
  typ: 'merchant_mfa';
  stage: MfaStage;
  jti: string;
  exp: number;
}

const invalidChallenge = () =>
  new AppError(
    'MFA_CHALLENGE_INVALID',
    HttpStatus.UNAUTHORIZED,
    'La verificación ha caducado. Vuelve a iniciar sesión.',
  );

/** Formato legible de un código de recuperación: `abcd-efgh-jk` (50 bits). */
const newRecoveryCode = (): string => {
  const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
};
const normalizeRecoveryCode = (code: string) => code.replace(/[\s-]/g, '').toLowerCase();

/**
 * Doble factor de los usuarios del comercio (ADR-013, ADR-025): TOTP con app de autenticación y
 * códigos de recuperación de un solo uso. Obligatorio para OWNER y MANAGER.
 *
 * Tras la contraseña se emite un token intermedio (`mfaToken`, 5 min) que solo sirve para el
 * segundo paso; la sesión la crea `AuthService.issueSession` cuando este servicio lo confirma.
 */
@Injectable()
export class MerchantMfaService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly revocations: TokenRevocationService,
  ) {}

  /** ¿Necesita este usuario el segundo factor para entrar? */
  static required(user: { role: MerchantPrincipal['role']; mfaEnabled: boolean }): boolean {
    return user.mfaEnabled || user.role === 'OWNER' || user.role === 'MANAGER';
  }

  async challenge(merchantUserId: string, stage: MfaStage): Promise<string> {
    return this.jwt.signAsync(
      { sub: merchantUserId, typ: 'merchant_mfa', stage },
      {
        expiresIn: MFA_CHALLENGE_TTL_SECONDS,
        issuer: JWT_ISSUER,
        audience: MERCHANT_MFA_AUDIENCE,
        jwtid: newId(),
      },
    );
  }

  /** Genera un secreto nuevo (pendiente hasta que se confirme con un código). */
  async setup(mfaToken: string): Promise<MfaSetupResponse> {
    const { user } = await this.openChallenge(mfaToken, 'setup');
    const secret = generateTotpSecret();
    await this.redis.set(
      this.pendingKey(user.id),
      encryptPii(secret, this.env.PII_ENCRYPTION_KEY),
      'EX',
      PENDING_SECRET_TTL_SECONDS,
    );
    return { secret, otpauthUri: otpauthUri(secret, user.email) };
  }

  /** Confirma el secreto pendiente con un código de la app y activa el doble factor. */
  async activate(
    mfaToken: string,
    code: string,
    ip?: string,
  ): Promise<{ principal: MerchantPrincipal; recoveryCodes: string[] }> {
    const { user, claims } = await this.openChallenge(mfaToken, 'setup');
    const pending = await this.redis.get(this.pendingKey(user.id));
    if (!pending) {
      throw new AppError(
        'MFA_SETUP_EXPIRED',
        HttpStatus.CONFLICT,
        'El código QR ha caducado. Genera uno nuevo.',
      );
    }
    const secret = decryptPii(pending, this.env.PII_ENCRYPTION_KEY);
    await this.checkCode(user, secret, code, ip);

    const recoveryCodes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    await this.db.transaction(async (tx) => {
      // Solo si sigue sin doble factor: dos activaciones simultáneas no pueden pisarse.
      const updated = await tx
        .update(merchantUsers)
        .set({
          mfaEnabled: true,
          mfaSecretEnc: encryptPii(secret, this.env.PII_ENCRYPTION_KEY),
          mfaEnabledAt: new Date(),
        })
        .where(and(eq(merchantUsers.id, user.id), eq(merchantUsers.mfaEnabled, false)))
        .returning({ id: merchantUsers.id });
      if (updated.length === 0) throw invalidChallenge();
      await tx
        .delete(merchantUserRecoveryCodes)
        .where(eq(merchantUserRecoveryCodes.merchantUserId, user.id));
      await tx.insert(merchantUserRecoveryCodes).values(
        recoveryCodes.map((c) => ({
          merchantUserId: user.id,
          codeHash: this.hashRecoveryCode(c),
        })),
      );
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: user.id,
          merchantId: user.merchantId,
          action: 'merchant_user.mfa_enabled',
          entity: 'merchant_user',
          entityId: user.id,
          ip,
        },
        tx,
      );
    });
    await this.redis.del(this.pendingKey(user.id));
    await this.revocations.revoke(claims.jti, claims.exp);
    return { principal: this.principalOf(user), recoveryCodes };
  }

  /** Segundo paso del login: código de la app o, si se ha perdido el móvil, uno de recuperación. */
  async verify(
    mfaToken: string,
    input: { code?: string; recoveryCode?: string },
    ip?: string,
  ): Promise<MerchantPrincipal> {
    const { user, claims } = await this.openChallenge(mfaToken, 'verify');
    if (!user.mfaEnabled || !user.mfaSecretEnc) throw invalidChallenge();

    if (input.recoveryCode) {
      await this.assertNotLocked(user.id);
      const [used] = await this.db
        .update(merchantUserRecoveryCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(merchantUserRecoveryCodes.merchantUserId, user.id),
            eq(merchantUserRecoveryCodes.codeHash, this.hashRecoveryCode(input.recoveryCode)),
            isNull(merchantUserRecoveryCodes.usedAt),
          ),
        )
        .returning({ id: merchantUserRecoveryCodes.id });
      if (!used) await this.fail(user, ip);
      await this.audit.record({
        actorType: 'MERCHANT_USER',
        actorId: user.id,
        merchantId: user.merchantId,
        action: 'merchant_user.mfa_recovery_code_used',
        entity: 'merchant_user',
        entityId: user.id,
        ip,
      });
    } else {
      const secret = decryptPii(user.mfaSecretEnc, this.env.PII_ENCRYPTION_KEY);
      await this.checkCode(user, secret, input.code ?? '', ip);
    }
    await this.redis.del(this.failuresKey(user.id));
    // El token intermedio es de un solo uso.
    await this.revocations.revoke(claims.jti, claims.exp);
    return this.principalOf(user);
  }

  private async openChallenge(token: string, stage: MfaStage) {
    let claims: MfaChallengePayload;
    try {
      claims = await this.jwt.verifyAsync<MfaChallengePayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: MERCHANT_MFA_AUDIENCE,
      });
    } catch {
      throw invalidChallenge();
    }
    if (claims.typ !== 'merchant_mfa' || claims.stage !== stage) throw invalidChallenge();
    if (await this.revocations.isRevoked(claims.jti)) throw invalidChallenge();
    const user = await this.db.query.merchantUsers.findFirst({
      where: eq(merchantUsers.id, claims.sub),
    });
    if (!user || user.status !== 'ACTIVE') throw invalidChallenge();
    return { user, claims };
  }

  /** Valida un TOTP: cuenta fallos por usuario e impide reutilizar el mismo código. */
  private async checkCode(user: MfaUser, secret: string, code: string, ip?: string) {
    await this.assertNotLocked(user.id);
    const step = verifyTotp(secret, code.trim());
    if (step === null) return this.fail(user, ip);
    // Un código capturado (por encima del hombro, phishing en tiempo real) no vale una segunda vez.
    const fresh = await this.redis.set(`mfa:used:${user.id}:${step}`, '1', 'EX', 120, 'NX');
    if (fresh !== 'OK') return this.fail(user, ip);
  }

  private async assertNotLocked(userId: string) {
    const failures = Number((await this.redis.get(this.failuresKey(userId))) ?? 0);
    if (failures >= MAX_MFA_FAILURES) {
      throw new AppError(
        'MFA_LOCKED',
        HttpStatus.TOO_MANY_REQUESTS,
        'Demasiados códigos incorrectos. Vuelve a intentarlo en 15 minutos.',
      );
    }
  }

  private async fail(user: MfaUser, ip?: string): Promise<never> {
    const key = this.failuresKey(user.id);
    await this.redis.multi().incr(key).expire(key, MFA_LOCK_SECONDS).exec();
    await this.audit.record({
      actorType: 'MERCHANT_USER',
      actorId: user.id,
      merchantId: user.merchantId,
      action: 'merchant_user.mfa_failed',
      entity: 'merchant_user',
      entityId: user.id,
      ip,
    });
    throw new AppError('MFA_CODE_INVALID', HttpStatus.UNAUTHORIZED, 'Código incorrecto');
  }

  private hashRecoveryCode(code: string): string {
    return hashPii(`recovery:${normalizeRecoveryCode(code)}`, this.env.PII_ENCRYPTION_KEY);
  }

  private principalOf(user: typeof merchantUsers.$inferSelect): MerchantPrincipal {
    return { merchantUserId: user.id, merchantId: user.merchantId, role: user.role };
  }

  private pendingKey = (userId: string) => `mfa:pending:${userId}`;
  private failuresKey = (userId: string) => `mfa:failures:${userId}`;
}
