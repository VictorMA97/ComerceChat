import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { MerchantLoginResult, MerchantUserRole } from '@comercechat/shared-types';
import { eq, inArray } from 'drizzle-orm';
import { AppError } from '@comercechat/service-kit';
import { DB, type Database } from '../../db/client.js';
import { MerchantMfaService, MFA_CHALLENGE_TTL_SECONDS } from '../auth/merchant-mfa.service.js';
import { hashPassword } from '../auth/passwords.js';
import { merchantUsers } from '../schema/merchant-users.js';

export interface MerchantUserInfo {
  id: string;
  merchantId: string;
  email: string;
  role: MerchantUserRole;
  mfaEnabled: boolean;
}

const emailTaken = () =>
  new AppError('EMAIL_TAKEN', HttpStatus.CONFLICT, 'Ya hay una cuenta con ese email');

/**
 * API pública de identity para el resto de contextos (ADR-029): usuarios del comercio. Con
 * servicios separados será `/internal/...` de identity (MIGRACION §3.3).
 */
@Injectable()
export class IdentityDirectory {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mfa: MerchantMfaService,
  ) {}

  async merchantUser(id: string): Promise<MerchantUserInfo | null> {
    const [u] = await this.db
      .select(userColumns)
      .from(merchantUsers)
      .where(eq(merchantUsers.id, id));
    return u ?? null;
  }

  /** Email de cada usuario del comercio pedido (para el registro de actividad). */
  async merchantUserEmails(ids: Iterable<string>): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({ id: merchantUsers.id, email: merchantUsers.email })
      .from(merchantUsers)
      .where(inArray(merchantUsers.id, unique));
    return new Map(rows.map((r) => [r.id, r.email]));
  }

  async isMerchantEmailTaken(email: string): Promise<boolean> {
    const [u] = await this.db
      .select({ id: merchantUsers.id })
      .from(merchantUsers)
      .where(eq(merchantUsers.email, normalizeEmail(email)));
    return Boolean(u);
  }

  /**
   * Segundo paso del registro de un comercio (FR-MER-01, ADR-029): crea su OWNER con el id que ya
   * figura en la auditoría del alta y devuelve el paso de activación del doble factor (ADR-025).
   */
  async createMerchantOwner(input: {
    id: string;
    merchantId: string;
    email: string;
    password: string;
  }): Promise<MerchantLoginResult> {
    const passwordHash = await hashPassword(input.password);
    try {
      await this.db.insert(merchantUsers).values({
        id: input.id,
        merchantId: input.merchantId,
        email: normalizeEmail(input.email),
        passwordHash,
        role: 'OWNER',
      });
    } catch (err) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      const e = err as { code?: string; cause?: { code?: string } };
      if ((e.code ?? e.cause?.code) === '23505') throw emailTaken();
      throw err;
    }
    return {
      step: 'MFA_SETUP_REQUIRED',
      mfaToken: await this.mfa.challenge(input.id, 'setup'),
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    };
  }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export { emailTaken };

const userColumns = {
  id: merchantUsers.id,
  merchantId: merchantUsers.merchantId,
  email: merchantUsers.email,
  role: merchantUsers.role,
  mfaEnabled: merchantUsers.mfaEnabled,
};
