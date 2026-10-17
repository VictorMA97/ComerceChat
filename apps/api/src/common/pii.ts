import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'node:crypto';

// Cifrado de datos personales a nivel de columna (ARCHITECTURE §9). En la PoC la clave viene de
// .env.local; en el MVP se sustituye por KMS.

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** Cifra con AES-256-GCM. Formato: base64url(iv[12] | tag[16] | ciphertext). */
export function encryptPii(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

export function decryptPii(encoded: string, secret: string): string {
  const buf = Buffer.from(encoded, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

/** Hash con clave para buscar por teléfono o email sin descifrar. */
export function hashPii(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
}
