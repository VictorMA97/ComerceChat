import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { MerchantLoginResult } from '@comercechat/shared-types';
import { eq } from 'drizzle-orm';
import { AuditService } from '../../audit/audit.service.js';
import type { MerchantPrincipal } from '../../identity/auth/auth.types.js';
import {
  MerchantMfaService,
  MFA_CHALLENGE_TTL_SECONDS,
} from '../../identity/auth/merchant-mfa.service.js';
import { hashPassword } from '../../identity/auth/passwords.js';
import { AppError } from '../../common/app-error.js';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/client.js';
import { merchants } from '../schema/merchants.js';
import { merchantUsers } from '../../identity/schema/merchant-users.js';

export interface MerchantRegistration {
  brandName: string;
  legalName: string;
  taxId: string;
  email: string;
  password: string;
}

const emailTaken = () =>
  new AppError('EMAIL_TAKEN', HttpStatus.CONFLICT, 'Ya hay una cuenta con ese email');

@Injectable()
export class MerchantsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly mfa: MerchantMfaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registro del comercio (FR-MER-01): crea el comercio en ONBOARDING y su OWNER. No abre sesión: el
   * OWNER tiene que activar el doble factor primero (ADR-025), así que se devuelve ese paso.
   */
  async register(input: MerchantRegistration, ip?: string): Promise<MerchantLoginResult> {
    const email = input.email.trim().toLowerCase();
    const exists = await this.db.query.merchantUsers.findFirst({
      where: eq(merchantUsers.email, email),
    });
    if (exists) throw emailTaken();
    const passwordHash = await hashPassword(input.password);

    let ownerId: string;
    try {
      ownerId = await this.db.transaction(async (tx) => {
        const [merchant] = await tx
          .insert(merchants)
          .values({
            brandName: input.brandName.trim(),
            legalName: input.legalName.trim(),
            taxId: input.taxId.trim().toUpperCase(),
            status: 'ONBOARDING',
          })
          .returning();
        const [owner] = await tx
          .insert(merchantUsers)
          .values({ merchantId: merchant!.id, email, passwordHash, role: 'OWNER' })
          .returning();
        await this.audit.record(
          {
            actorType: 'MERCHANT_USER',
            actorId: owner!.id,
            merchantId: merchant!.id,
            action: 'merchant.registered',
            entity: 'merchant',
            entityId: merchant!.id,
            after: { brandName: merchant!.brandName },
            ip,
          },
          tx,
        );
        return owner!.id;
      });
    } catch (err) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      const e = err as { code?: string; cause?: { code?: string } };
      if ((e.code ?? e.cause?.code) === '23505') throw emailTaken();
      throw err;
    }
    return {
      step: 'MFA_SETUP_REQUIRED',
      mfaToken: await this.mfa.challenge(ownerId, 'setup'),
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    };
  }

  /**
   * Alta ante el PSP simulado (sustituye a FR-MER-02 en la PoC): el comercio pasa a ACTIVE y sus QR
   * empiezan a aceptar pagos. Con un PSP real el estado lo cambia el webhook de verificación (M1).
   */
  async simulatePspOnboarding(principal: MerchantPrincipal, ip?: string): Promise<void> {
    if (this.env.PAYMENT_PROVIDER !== 'fake') {
      throw new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, 'Solo con el PSP simulado');
    }
    await this.db.transaction(async (tx) => {
      const [m] = await tx
        .update(merchants)
        .set({ status: 'ACTIVE', psp: 'fake', pspKybStatus: 'APPROVED_SIMULATED' })
        .where(eq(merchants.id, principal.merchantId))
        .returning({ id: merchants.id });
      if (!m) throw new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, 'Comercio no encontrado');
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: principal.merchantUserId,
          merchantId: principal.merchantId,
          action: 'merchant.psp_onboarding_simulated',
          entity: 'merchant',
          entityId: principal.merchantId,
          ip,
        },
        tx,
      );
    });
  }
}
