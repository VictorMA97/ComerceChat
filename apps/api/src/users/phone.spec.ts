import { describe, expect, it } from 'vitest';
import { maskPhone, normalizePhone } from './phone.js';

describe('teléfonos', () => {
  it('normaliza números españoles y E.164', () => {
    expect(normalizePhone('600 000 001')).toBe('+34600000001');
    expect(normalizePhone('+34 600-000-001')).toBe('+34600000001');
    expect(normalizePhone('0033612345678')).toBe('+33612345678');
  });

  it('rechaza números no válidos', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });

  it('enmascara el número', () => {
    expect(maskPhone('+34600000001')).toBe('+34 6•• ••• •01');
  });
});
