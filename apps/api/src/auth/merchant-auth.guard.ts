import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MerchantUserRole } from '@comercechat/shared-types';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { AuthService } from './auth.service.js';
import type { MerchantPrincipal } from './auth.types.js';

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

@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const principal =
      scheme === 'Bearer' && token ? await this.auth.verifyMerchantToken(token) : null;
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
