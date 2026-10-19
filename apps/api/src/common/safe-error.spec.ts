import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { safeErrorForLog } from './safe-error.js';

describe('safeErrorForLog', () => {
  it('no incluye la consulta ni los parámetros de un error de Drizzle', () => {
    const cause = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'users_phone_hash_unique',
      table: 'users',
    });
    const err = new DrizzleQueryError(
      'insert into "users" ("phone_hash", "phone_e164_enc") values ($1, $2)',
      ['a1b2c3-hash-del-telefono', 'cifrado-del-telefono'],
      cause,
    );
    const out = safeErrorForLog(err);
    expect(out).toContain('pg=23505');
    expect(out).toContain('constraint=users_phone_hash_unique');
    expect(out).not.toContain('a1b2c3-hash-del-telefono');
    expect(out).not.toContain('cifrado-del-telefono');
    expect(out).not.toContain('insert into');
  });

  it('conserva el mensaje y la pila de los demás errores', () => {
    const out = safeErrorForLog(new TypeError('x is undefined'));
    expect(out).toMatch(/^TypeError: x is undefined\n\s+at /);
  });
});
