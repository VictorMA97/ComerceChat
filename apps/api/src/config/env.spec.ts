import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  WEB_QR_BASE_URL: 'http://localhost:3000',
  MERCHANT_PANEL_BASE_URL: 'http://localhost:3001',
  JWT_SECRET: 'x'.repeat(32),
  QR_HMAC_SECRET: 'y'.repeat(32),
  PII_ENCRYPTION_KEY: 'z'.repeat(32),
  FAKE_PSP_WEBHOOK_SECRET: 'w'.repeat(32),
  QR_SIGNING_KEY: 'k'.repeat(48),
};

describe('parseEnv', () => {
  it('acepta simuladores fuera de producción', () => {
    expect(parseEnv({ ...base, NODE_ENV: 'development' }).PAYMENT_PROVIDER).toBe('fake');
  });

  it('impide arrancar en producción con proveedores simulados (ADR-018)', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /Proveedores simulados no permitidos en producción: PAYMENT_PROVIDER=fake/,
    );
  });

  it('exige secretos de al menos 32 caracteres', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });
});
