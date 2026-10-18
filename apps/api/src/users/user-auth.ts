import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';

interface UserJwtPayload {
  sub: string;
  typ: 'user';
}

type UserRequest = Request & { userId?: string | null };

/** Tokens de sesión del comensal (distintos de los del comercio por `typ`). */
@Injectable()
export class UserTokens {
  constructor(private readonly jwt: JwtService) {}

  sign(userId: string, expiresIn: number): Promise<string> {
    return this.jwt.signAsync({ sub: userId, typ: 'user' } satisfies UserJwtPayload, { expiresIn });
  }

  async verify(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    try {
      const p = await this.jwt.verifyAsync<UserJwtPayload>(token);
      return p.typ === 'user' ? p.sub : null;
    } catch {
      return null;
    }
  }

  /** Lee el usuario del `Authorization: Bearer` (opcional) y lo deja en la petición. */
  async fromRequest(req: UserRequest): Promise<string | null> {
    if (req.userId !== undefined) return req.userId;
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    req.userId = scheme === 'Bearer' ? await this.verify(token) : null;
    return req.userId;
  }
}

/** Exige un comensal autenticado. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly tokens: UserTokens) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!(await this.tokens.fromRequest(ctx.switchToHttp().getRequest<UserRequest>()))) {
      throw new AppError(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'Inicia sesión con tu teléfono',
      );
    }
    return true;
  }
}

/** Usuario autenticado (con `UserAuthGuard`) u opcional (`null` si no hay sesión válida). */
export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<UserRequest>().userId ?? null,
);

/** Guard que nunca bloquea: solo resuelve el usuario si hay token, para endpoints públicos. */
@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(private readonly tokens: UserTokens) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await this.tokens.fromRequest(ctx.switchToHttp().getRequest<UserRequest>());
    return true;
  }
}
