import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AppError } from '@comercechat/service-kit';
import type { Request } from 'express';

/**
 * Valida un token de sesión del comensal (ADR-024): firma, revocación y estado de la cuenta. Devuelve
 * el id del usuario o `null`. En la PoC lo implementa identity en el mismo proceso; con servicios
 * separados será una llamada a `POST /internal/sessions/user` (MIGRACION §3.3).
 */
export interface UserSessionVerifier {
  verifyUserToken(token: string | undefined): Promise<string | null>;
}

export const USER_SESSION_VERIFIER = Symbol('USER_SESSION_VERIFIER');

type UserRequest = Request & { userId?: string | null };

/** Lee el usuario del `Authorization: Bearer` (opcional) y lo deja en la petición. */
async function resolveUser(
  req: UserRequest,
  sessions: UserSessionVerifier,
): Promise<string | null> {
  if (req.userId !== undefined) return req.userId;
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  req.userId = scheme === 'Bearer' ? await sessions.verifyUserToken(token) : null;
  return req.userId;
}

/** Exige un comensal autenticado. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(@Inject(USER_SESSION_VERIFIER) private readonly sessions: UserSessionVerifier) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!(await resolveUser(ctx.switchToHttp().getRequest<UserRequest>(), this.sessions))) {
      throw new AppError(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'Inicia sesión con tu teléfono',
      );
    }
    return true;
  }
}

/** Guard que nunca bloquea: solo resuelve el usuario si hay token, para endpoints públicos. */
@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(@Inject(USER_SESSION_VERIFIER) private readonly sessions: UserSessionVerifier) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await resolveUser(ctx.switchToHttp().getRequest<UserRequest>(), this.sessions);
    return true;
  }
}

/** Usuario autenticado (con `UserAuthGuard`) u opcional (`null` si no hay sesión válida). */
export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<UserRequest>().userId ?? null,
);
