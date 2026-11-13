import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/base-env.js';

/** Cabecera con el secreto compartido de las llamadas entre servicios (MIGRACION §3.3). */
export const INTERNAL_SECRET_HEADER = 'x-cc-internal-secret';

/**
 * Protege las rutas `/v1/internal/*`, que solo llaman otros servicios. El gateway no las enruta
 * (ADR-030); además exigen el secreto compartido `INTERNAL_SERVICE_SECRET`. Al pasar a Kubernetes,
 * se puede sustituir por mTLS (MIGRACION §9).
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly secret: Buffer;

  constructor(@Inject(ENV) env: Env) {
    this.secret = Buffer.from(env.INTERNAL_SERVICE_SECRET);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const given = ctx.switchToHttp().getRequest<Request>().headers[INTERNAL_SECRET_HEADER];
    const g = Buffer.from(typeof given === 'string' ? given : '');
    if (
      this.secret.length === 0 ||
      g.length !== this.secret.length ||
      !timingSafeEqual(g, this.secret)
    ) {
      throw new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, 'Ruta no encontrada');
    }
    return true;
  }
}
