import { createPrivateKey, createPublicKey, type KeyObject, sign, verify } from 'node:crypto';

/** Contenido firmado del QR de cobro de una mesa generado desde la caja (ARCHITECTURE §8). */
export interface DynamicQrPayload {
  qrId: string;
  locationId: string;
  tableId: string;
  amountCents: number;
  /** Caducidad, en segundos Unix. */
  exp: number;
  nonce: string;
}

const KID = 'poc-1';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

export class DynamicQrKeys {
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;

  /** `pkcs8Base64Url`: clave Ed25519 en PKCS#8 DER (la genera `pnpm poc:keys` en QR_SIGNING_KEY). */
  constructor(pkcs8Base64Url: string) {
    this.privateKey = createPrivateKey({
      key: Buffer.from(pkcs8Base64Url, 'base64url'),
      format: 'der',
      type: 'pkcs8',
    });
    this.publicKey = createPublicKey(this.privateKey);
  }
}

/** JWS compacto (EdDSA): `header.payload.firma`, en base64url. Determinista para el mismo contenido. */
export function signDynamicQr(keys: DynamicQrKeys, payload: DynamicQrPayload): string {
  const signingInput = `${b64({ alg: 'EdDSA', typ: 'JWT', kid: KID })}.${b64(payload)}`;
  const signature = sign(null, Buffer.from(signingInput), keys.privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

/** Verifica firma y formato. La caducidad y el nonce se comprueban aparte (necesitan la BD). */
export function verifyDynamicQr(keys: DynamicQrKeys, token: string): DynamicQrPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString()) as {
      alg?: string;
      kid?: string;
    };
    if (h.alg !== 'EdDSA' || h.kid !== KID) return null;
    const ok = verify(
      null,
      Buffer.from(`${header}.${payload}`),
      keys.publicKey,
      Buffer.from(signature, 'base64url'),
    );
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as DynamicQrPayload;
    const valid =
      typeof p.qrId === 'string' &&
      typeof p.locationId === 'string' &&
      typeof p.tableId === 'string' &&
      Number.isInteger(p.amountCents) &&
      Number.isInteger(p.exp) &&
      typeof p.nonce === 'string';
    return valid ? p : null;
  } catch {
    return null;
  }
}
