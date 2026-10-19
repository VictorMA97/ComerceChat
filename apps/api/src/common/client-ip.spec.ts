import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, clientIp, PROXY_AUTH_HEADER } from './client-ip.js';

const SECRET = 's'.repeat(32);
const req = (headers: Record<string, string>, ip = '10.0.0.5') =>
  ({ headers, ip, socket: {} }) as unknown as Request;

describe('clientIp', () => {
  it('usa la IP reenviada por Next cuando llega con el secreto', () => {
    expect(
      clientIp(req({ [PROXY_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: '203.0.113.9' }), SECRET),
    ).toBe('203.0.113.9');
  });

  it('ignora la IP reenviada sin el secreto correcto: no se puede elegir la IP', () => {
    expect(clientIp(req({ [CLIENT_IP_HEADER]: '203.0.113.9' }), SECRET)).toBe('10.0.0.5');
    expect(
      clientIp(req({ [PROXY_AUTH_HEADER]: 'otro', [CLIENT_IP_HEADER]: '203.0.113.9' }), SECRET),
    ).toBe('10.0.0.5');
  });

  it('ignora una IP reenviada mal formada', () => {
    expect(
      clientIp(req({ [PROXY_AUTH_HEADER]: SECRET, [CLIENT_IP_HEADER]: 'x; rm -rf' }), SECRET),
    ).toBe('10.0.0.5');
  });
});
