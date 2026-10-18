import { createHmac, timingSafeEqual } from 'node:crypto';

export const FAKE_PSP_SIGNATURE_HEADER = 'fake-psp-signature';
const TOLERANCE_SECONDS = 300;

/** Firma estilo Stripe: `t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`. */
export function signFakePspPayload(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

export function verifyFakePspSignature(
  secret: string,
  body: Buffer | string,
  header: string | undefined,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isInteger(t) || Math.abs(now - t) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${t}.${body.toString()}`).digest('hex'),
    'hex',
  );
  const given = Buffer.from(parts.v1, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
