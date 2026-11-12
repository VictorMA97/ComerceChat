import { describe, expect, it } from 'vitest';
import { signFakePspPayload, verifyFakePspSignature } from './fake-psp-signature.js';

const secret = 's'.repeat(32);
const body = '{"id":"evt_1"}';

describe('firma de webhooks del PSP simulado', () => {
  it('acepta una firma válida', () => {
    expect(verifyFakePspSignature(secret, body, signFakePspPayload(secret, body))).toBe(true);
  });

  it('rechaza cuerpo alterado, otro secreto, cabecera ausente o mal formada', () => {
    const header = signFakePspPayload(secret, body);
    expect(verifyFakePspSignature(secret, '{"id":"evt_2"}', header)).toBe(false);
    expect(verifyFakePspSignature('o'.repeat(32), body, header)).toBe(false);
    expect(verifyFakePspSignature(secret, body, undefined)).toBe(false);
    expect(verifyFakePspSignature(secret, body, 'basura')).toBe(false);
  });

  it('rechaza firmas fuera de la ventana de 5 minutos (repetición)', () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    expect(verifyFakePspSignature(secret, body, signFakePspPayload(secret, body, old))).toBe(false);
  });
});
