import { describe, expect, it } from 'vitest';
import { decryptPii, encryptPii, hashPii } from './pii.js';

const key = 'k'.repeat(32);

describe('cifrado de datos personales', () => {
  it('cifra de forma no determinista y descifra', () => {
    const a = encryptPii('+34600000001', key);
    expect(a).not.toBe(encryptPii('+34600000001', key));
    expect(decryptPii(a, key)).toBe('+34600000001');
  });

  it('falla al descifrar con otra clave', () => {
    expect(() => decryptPii(encryptPii('x', key), 'o'.repeat(32))).toThrow();
  });

  it('el hash de búsqueda normaliza mayúsculas y espacios', () => {
    expect(hashPii(' Ana@Example.com ', key)).toBe(hashPii('ana@example.com', key));
  });
});
