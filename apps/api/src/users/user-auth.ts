import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import {
  JWT_ISSUER,
  TokenRevocationService,
  USER_AUDIENCE,
} from '../auth/token-revocation.service.js';
import { AppError } from '../common/app-error.js';
import { newId } from '../common/ids.js';
import { DB, type Database } from '../db/client.js';
import { users } from '../db/schema/index.js';

interface UserJwtPayload {
  sub: string;
  typ: 'user';
  jti: string;
  exp: number;
}

type UserRequest = Request & { userId?: string | null };

/** Tokens de sesión del comensal (distintos de los del comercio por audiencia y `typ`). */
@Injectable()
export class UserTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly revocations: TokenRevocationService,
    @Inject(DB) private readonly db: Database,
  ) {}

  sign(userId: string, expiresIn: number): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, typ: 'user' },
      {
        expiresIn,
        issuer: JWT_ISSUER,
        audience: USER_AUDIENCE,
        jwtid: newId(),
      },
    );
  }

  /** Id del usuario si el token es válido, no se ha revocado y la cuenta sigue activa. */
  async verify(token: string | undefined): Promise<string | null> {
    const p = await this.decode(token);
    if (!p || (await this.revocations.isRevoked(p.jti))) return null;
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, p.sub),
      columns: { status: true },
    });
    return user?.status === 'ACTIVE' ? p.sub : null;
  }

  /** Cierre de sesión: el token deja de valer aunque no haya caducado. */
  async revoke(token: string | undefined): Promise<void> {
    const p = await this.decode(token);
    if (p) await this.revocations.revoke(p.jti, p.exp);
  }

  private async decode(token: string | undefined): Promise<UserJwtPayload | null> {
    if (!token) return null;
    try {
      const p = await this.jwt.verifyAsync<UserJwtPayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: USER_AUDIENCE,
      });
      return p.typ === 'user' && typeof p.jti === 'string' ? p : null;
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
