import { describe, expect, it } from 'vitest';
import { generateShortCode, qrUrl, SHORT_CODE_LENGTH, signQr, verifyQrSignature } from './qr-signature.js';

const secret = 's'.repeat(32);
const qr = { id: 'qr-1', locationId: 'loc-1', tableId: 'table-1', version: 1 };

describe('firma de QR', () => {
  it('verifica una firma correcta', () => {
    expect(verifyQrSignature(secret, qr, signQr(secret, qr))).toBe(true);
  });

  it.each([
    ['otra mesa', { ...qr, tableId: 'table-2' }],
    ['otro local', { ...qr, locationId: 'loc-2' }],
    ['otra versión', { ...qr, version: 2 }],
  ])('rechaza la firma si cambia %s', (_, tampered) => {
    expect(verifyQrSignature(secret, tampered, signQr(secret, qr))).toBe(false);
  });

  it('rechaza firmas con otro secreto o mal formadas', () => {
    expect(verifyQrSignature(secret, qr, signQr('t'.repeat(32), qr))).toBe(false);
    expect(verifyQrSignature(secret, qr, 'abc')).toBe(false);
  });

  it('genera códigos base62 de la longitud esperada y no repetidos', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateShortCode));
    expect(codes.size).toBe(1000);
    for (const c of codes) expect(c).toMatch(new RegExp(`^[0-9A-Za-z]{${SHORT_CODE_LENGTH}}$`));
  });

  it('construye la URL pública del QR', () => {
    expect(qrUrl('http://localhost:3000/', 'AbC')).toBe('http://localhost:3000/t/AbC');
  });
});
