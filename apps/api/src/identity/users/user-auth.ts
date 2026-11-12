import { Inject, Injectable } from '@nestjs/common';
import type { UserSessionVerifier } from '@comercechat/auth-client';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import {
  JWT_ISSUER,
  TokenRevocationService,
  USER_AUDIENCE,
} from '../auth/token-revocation.service.js';
import { newId } from '@comercechat/service-kit';
import { DB, type Database } from '../../db/client.js';
import { users } from '../schema/users.js';

interface UserJwtPayload {
  sub: string;
  typ: 'user';
  jti: string;
  exp: number;
}

/**
 * Tokens de sesión del comensal (distintos de los del comercio por audiencia y `typ`). Es el
 * `UserSessionVerifier` que usan los guards de @comercechat/auth-client en este proceso.
 */
@Injectable()
export class UserTokens implements UserSessionVerifier {
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

  verifyUserToken(token: string | undefined): Promise<string | null> {
    return this.verify(token);
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
}
