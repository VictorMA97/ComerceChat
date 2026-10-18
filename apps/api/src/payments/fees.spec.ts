import { describe, expect, it } from 'vitest';
import { platformFeeCents, statementDescriptor } from './fees.js';

describe('comisión de plataforma', () => {
  it('aplica los puntos básicos y el fijo sobre el importe', () => {
    expect(platformFeeCents(4_250, 50, 0)).toBe(21);
    expect(platformFeeCents(4_250, 50, 10)).toBe(31);
  });

  it('no cobra comisión sobre importes nulos', () => {
    expect(platformFeeCents(0, 50, 10)).toBe(0);
  });
});

describe('descripción en el extracto', () => {
  it('quita acentos y símbolos y limita a 22 caracteres', () => {
    expect(statementDescriptor('La Tasca de Ana')).toBe('COMERCECHAT*LA TASCA D');
    expect(statementDescriptor('Café Ñandú & Co.')).toBe('COMERCECHAT*CAFE NANDU');
    expect(statementDescriptor('Casa Pepe').length).toBeLessThanOrEqual(22);
  });
});
