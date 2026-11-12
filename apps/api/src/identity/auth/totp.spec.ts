import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totp,
  totpAt,
  totpStep,
  verifyTotp,
} from './totp.js';

// Secreto de los vectores de prueba del RFC 6238 (apéndice B, SHA-1): "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('cumple los vectores de prueba del RFC (últimos 6 dígitos)', () => {
    const vectors: [number, string][] = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
    ];
    for (const [seconds, code] of vectors) {
      expect(totp(RFC_SECRET, seconds * 1000)).toBe(code);
    }
  });

  it('base32 ida y vuelta', () => {
    const buf = Buffer.from('hola, ComerceChat');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(base32Decode('jbsw y3dp')).toEqual(base32Decode('JBSWY3DP'));
  });

  it('admite un paso de desfase y devuelve el paso usado', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const step = totpStep(now);
    expect(verifyTotp(secret, totpAt(secret, step), now)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(secret, totpAt(secret, step - 2), now)).toBeNull();
  });

  it('rechaza formatos que no son 6 dígitos', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '12345')).toBeNull();
    expect(verifyTotp(secret, 'abcdef')).toBeNull();
    expect(verifyTotp(secret, '1234567')).toBeNull();
  });

  it('genera secretos de 160 bits y una URI otpauth válida', () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    const uri = new URL(otpauthUri(secret, 'owner@casapepe.test'));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.searchParams.get('secret')).toBe(secret);
    expect(uri.searchParams.get('issuer')).toBe('ComerceChat');
  });
});
