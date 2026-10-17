import { randomInt } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

/** Identificador interno (UUIDv7, ordenable por tiempo). */
export const newId = (): string => uuidv7();

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Código público aleatorio en base62 (no secuencial ni adivinable). */
export function randomBase62(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += BASE62[randomInt(BASE62.length)];
  return out;
}
