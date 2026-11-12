import { describe, expect, it } from 'vitest';
import { maskIp } from './audit.controller.js';

describe('maskIp', () => {
  it('recorta IPv4, IPv4 mapeada e IPv6', () => {
    expect(maskIp('83.45.120.7')).toBe('83.45.120.x');
    expect(maskIp('::ffff:10.0.0.12')).toBe('10.0.0.x');
    expect(maskIp('2a02:9130:84ab:1:2:3:4:5')).toBe('2a02:9130:84ab:…');
    expect(maskIp('::1')).toBe('local');
    expect(maskIp('127.0.0.1')).toBe('local');
    expect(maskIp(null)).toBeNull();
  });
});
