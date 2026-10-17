import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomBase62 } from '../common/ids.js';

/** Longitud del código público de QR estático (≥ 10 base62, FR-QR-01): ~65 bits de entropía. */
export const SHORT_CODE_LENGTH = 11;

export const generateShortCode = (): string => randomBase62(SHORT_CODE_LENGTH);

export interface QrSignatureInput {
  id: string;
  locationId: string;
  tableId: string | null;
  version: number;
}

const canonical = (q: QrSignatureInput) =>
  [q.id, q.locationId, q.tableId ?? '-', q.version].join('|');

/** HMAC-SHA256 sobre los campos que identifican el QR (ARCHITECTURE §8). */
export function signQr(secret: string, q: QrSignatureInput): string {
  return createHmac('sha256', secret).update(canonical(q)).digest('hex');
}

export function verifyQrSignature(secret: string, q: QrSignatureInput, signature: string): boolean {
  const expected = Buffer.from(signQr(secret, q), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const qrUrl = (webQrBaseUrl: string, shortCode: string): string =>
  `${webQrBaseUrl.replace(/\/$/, '')}/t/${shortCode}`;
