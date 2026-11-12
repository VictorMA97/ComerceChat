import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Códigos de un solo uso basados en tiempo (RFC 6238, TOTP) para el doble factor de los comercios
// (ADR-013, ADR-025). SHA-1, 6 dígitos y pasos de 30 s: lo que entienden todas las apps de
// autenticación (Google Authenticator, 1Password, Authy…).

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error('Secreto TOTP no válido (base32)');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secreto nuevo de 160 bits (lo que recomienda el RFC 4226), en base32. */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

/** Paso de tiempo (contador) al que pertenece un instante. */
export const totpStep = (atMs: number = Date.now()): number =>
  Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);

/** Código de un paso concreto (HOTP sobre el contador de tiempo, RFC 4226 §5.3). */
export function totpAt(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export const totp = (secretBase32: string, atMs: number = Date.now()): string =>
  totpAt(secretBase32, totpStep(atMs));

/**
 * Comprueba un código admitiendo ±1 paso de desfase de reloj. Devuelve el paso que coincide (para
 * impedir que el mismo código se use dos veces) o `null`.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = totpStep(atMs);
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(totpAt(secretBase32, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** URI `otpauth://` que se muestra como QR para dar de alta el secreto en la app de autenticación. */
export function otpauthUri(secretBase32: string, account: string, issuer = 'ComerceChat'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
