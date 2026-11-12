import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { MerchantLoginResult } from '@comercechat/shared-types';
import { eq } from 'drizzle-orm';
import { AuditEmitter, AppError, newId } from '@comercechat/service-kit';
import { ENV, type Env } from '../../config/env.js';
import { DB, type Database } from '../../db/client.js';
import {
  emailTaken,
  IdentityDirectory,
  normalizeEmail,
} from '../../identity/public/identity-directory.js';
import type { MerchantPrincipal } from '../../identity/public/session.js';
import { merchants } from '../schema/merchants.js';

export interface MerchantRegistration {
  brandName: string;
  legalName: string;
  taxId: string;
  email: string;
  password: string;
}

@Injectable()
export class MerchantsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly identity: IdentityDirectory,
    private readonly audit: AuditEmitter,
  ) {}

  /**
   * Registro del comercio (FR-MER-01) en dos pasos (ADR-029): merchant-venues crea el comercio en
   * ONBOARDING e identity crea su OWNER. Si el segundo paso falla (p. ej. dos altas simultáneas con
   * el mismo email), queda un comercio en ONBOARDING sin usuarios, que no acepta pagos. No abre
   * sesión: el OWNER tiene que activar el doble factor primero (ADR-025).
   */
  async register(input: MerchantRegistration, ip?: string): Promise<MerchantLoginResult> {
    const email = normalizeEmail(input.email);
    if (await this.identity.isMerchantEmailTaken(email)) throw emailTaken();
    // El id del OWNER se fija aquí para que la auditoría del alta ya lo nombre como actor.
    const ownerId = newId();
    const merchantId = await this.db.transaction(async (tx) => {
      const [merchant] = await tx
        .insert(merchants)
        .values({
          brandName: input.brandName.trim(),
          legalName: input.legalName.trim(),
          taxId: input.taxId.trim().toUpperCase(),
          status: 'ONBOARDING',
        })
        .returning();
      await this.audit.record(
        {
          actorType: 'MERCHANT_USER',
          actorId: ownerId,
          merchantId: merchant!.id,
          action: 'merchant.registered',
          entity: 'merchant',
          entityId: merchant!.id,
          after: { brandName: merchant!.brandName },
          ip,
        },
        tx,
      );
      return merchant!.id;
    });
    return this.identity.createMerchantOwner({
      id: ownerId,
      merchantId,
      email,
      password: input.password,
    });
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
