import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { DB, type Database } from '../db/client.js';
import { idempotencyKeys } from '../db/schema/index.js';

const KEY_PATTERN = /^[A-Za-z0-9_:-]{8,200}$/;
const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency-Key (ARCHITECTURE §11, ADR-015): la misma clave con el mismo cuerpo devuelve la misma
 * respuesta; con otro cuerpo es un error. Si la operación falla, la clave se libera para reintentar.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async run<T>(
    scope: string,
    key: string | undefined,
    body: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key || !KEY_PATTERN.test(key)) {
      throw new AppError(
        'IDEMPOTENCY_KEY_REQUIRED',
        HttpStatus.BAD_REQUEST,
        'Falta la cabecera Idempotency-Key (8–200 caracteres [A-Za-z0-9_:-])',
      );
    }
    const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const [claimed] = await this.db
      .insert(idempotencyKeys)
      .values({ scope, key, requestHash })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });

    if (!claimed) {
      const existing = await this.db.query.idempotencyKeys.findFirst({
        where: and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)),
      });
      if (existing?.requestHash !== requestHash) {
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSED',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Esta Idempotency-Key ya se usó con otra petición',
        );
      }
      if (existing.response === null) {
        throw new AppError(
          'IDEMPOTENCY_IN_PROGRESS',
          HttpStatus.CONFLICT,
          'La petición original sigue en curso',
        );
      }
      return existing.response as T;
    }

    try {
      const result = await fn();
      await this.db
        .update(idempotencyKeys)
        .set({ response: result as object, statusCode: 201 })
        .where(eq(idempotencyKeys.id, claimed.id));
      return result;
    } catch (err) {
      await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, claimed.id));
      throw err;
    }
  }

  async purgeExpired(): Promise<void> {
    await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - RETENTION_MS)));
  }
}
