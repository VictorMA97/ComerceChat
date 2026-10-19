import { describe, expect, it } from 'vitest';
import { clientIpFrom, forwardedClientHeaders } from './forwarding.js';

describe('clientIpFrom', () => {
  it('prefiere la IP que pone Cloudflare', () => {
    const h = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.1' });
    expect(clientIpFrom(h)).toBe('203.0.113.7');
  });

  it('usa la última entrada de x-forwarded-for, no la que escribe el cliente', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 198.51.100.9' });
    expect(clientIpFrom(h)).toBe('198.51.100.9');
  });

  it('ignora valores que no son una IP', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': 'evil' }))).toBeNull();
  });
});

describe('forwardedClientHeaders', () => {
  it('no envía nada sin secreto', () => {
    expect(forwardedClientHeaders(new Headers({ 'x-real-ip': '::1' }), undefined)).toEqual({});
  });

  it('envía la IP con el secreto', () => {
    expect(forwardedClientHeaders(new Headers({ 'x-real-ip': '::1' }), 's')).toEqual({
      'x-cc-proxy-auth': 's',
      'x-cc-client-ip': '::1',
    });
  });
});
