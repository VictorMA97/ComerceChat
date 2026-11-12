import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MerchantUserRole } from '@comercechat/shared-types';
import { AppError } from '@comercechat/service-kit';
import type { Request } from 'express';

/** Identidad de un usuario del panel de comercio, tal como viaja en el JWT. */
export interface MerchantPrincipal {
  merchantUserId: string;
  merchantId: string;
  role: MerchantUserRole;
}

/**
 * Valida un token de sesión del panel con los criterios de identity (ADR-025): firma, revocación, rol,
 * estado y doble factor leídos al momento. En la PoC lo implementa identity en el mismo proceso; con
 * servicios separados será una llamada a `POST /internal/sessions/merchant` (MIGRACION §3.3).
 */
export interface MerchantSessionVerifier {
  verifyMerchantToken(token: string): Promise<MerchantPrincipal | null>;
}

export const MERCHANT_SESSION_VERIFIER = Symbol('MERCHANT_SESSION_VERIFIER');

type AuthedRequest = Request & { merchantPrincipal?: MerchantPrincipal };

const ROLES_KEY = 'merchantRoles';

/** Restringe un endpoint a ciertos roles del comercio (control de acceso por roles). */
export const MerchantRoles = (...roles: MerchantUserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta la identidad del usuario del comercio autenticado. */
export const CurrentMerchant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): MerchantPrincipal => {
    const principal = ctx.switchToHttp().getRequest<AuthedRequest>().merchantPrincipal;
    if (!principal) throw new Error('CurrentMerchant usado sin MerchantAuthGuard');
    return principal;
  },
);

/** Exige una sesión válida del panel y, con `@MerchantRoles`, uno de los roles indicados. */
@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(
    @Inject(MERCHANT_SESSION_VERIFIER) private readonly sessions: MerchantSessionVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const principal =
      scheme === 'Bearer' && token ? await this.sessions.verifyMerchantToken(token) : null;
    if (!principal) {
      throw new AppError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED, 'Sesión no válida o caducada');
    }
    const roles = this.reflector.getAllAndOverride<MerchantUserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(principal.role)) {
      throw new AppError('FORBIDDEN_ROLE', HttpStatus.FORBIDDEN, 'Tu rol no permite esta acción');
    }
    req.merchantPrincipal = principal;
    return true;
  }
}
