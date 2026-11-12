import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DynamicQrKeys, signDynamicQr, verifyDynamicQr } from './dynamic-qr-token.js';

const pkcs8 = () =>
  generateKeyPairSync('ed25519')
    .privateKey.export({ format: 'der', type: 'pkcs8' })
    .toString('base64url');
const keys = new DynamicQrKeys(pkcs8());
const payload = {
  qrId: 'qr-1',
  locationId: 'loc-1',
  tableId: 'table-1',
  amountCents: 1250,
  exp: 1_900_000_000,
  nonce: 'n1',
};

describe('token de QR dinámico (JWS EdDSA)', () => {
  it('firma y verifica', () => {
    expect(verifyDynamicQr(keys, signDynamicQr(keys, payload))).toEqual(payload);
  });

  it('es determinista para el mismo contenido', () => {
    expect(signDynamicQr(keys, payload)).toBe(signDynamicQr(keys, payload));
  });

  it('rechaza un importe manipulado', () => {
    const [h, , s] = signDynamicQr(keys, payload).split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, amountCents: 1 })).toString(
      'base64url',
    );
    expect(verifyDynamicQr(keys, `${h}.${forged}.${s}`)).toBeNull();
  });

  it('rechaza tokens de otra clave o mal formados', () => {
    expect(verifyDynamicQr(keys, signDynamicQr(new DynamicQrKeys(pkcs8()), payload))).toBeNull();
    expect(verifyDynamicQr(keys, 'a.b')).toBeNull();
    expect(verifyDynamicQr(keys, 'a.b.c')).toBeNull();
  });
});
