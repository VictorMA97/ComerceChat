import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@comercechat/shared-types';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import {
  MERCHANT_AUTH_PROVIDER,
  type MerchantAuthProvider,
  type MerchantPrincipal,
} from './auth.types.js';

interface MerchantJwtPayload {
  sub: string;
  mid: string;
  role: MerchantPrincipal['role'];
  typ: 'merchant';
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(MERCHANT_AUTH_PROVIDER) private readonly provider: MerchantAuthProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async loginMerchant(email: string, password: string, ip?: string): Promise<LoginResponse> {
    const principal = await this.provider.authenticate(email, password);
    if (!principal) {
      await this.audit.record({
        actorType: 'MERCHANT_USER',
        action: 'merchant_user.login_failed',
        entity: 'merchant_user',
        after: { email: email.trim().toLowerCase() },
        ip,
      });
      throw new AppError('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED, 'Email o contraseña incorrectos');
    }
    const payload: MerchantJwtPayload = {
      sub: principal.merchantUserId,
      mid: principal.merchantId,
      role: principal.role,
      typ: 'merchant',
    };
    const expiresIn = this.env.JWT_MERCHANT_TTL_SECONDS;
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
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

  async verifyMerchantToken(token: string): Promise<MerchantPrincipal | null> {
    try {
      const p = await this.jwt.verifyAsync<MerchantJwtPayload>(token);
      if (p.typ !== 'merchant') return null;
      return { merchantUserId: p.sub, merchantId: p.mid, role: p.role };
    } catch {
      return null;
    }
  }
}
