import { describe, expect, it } from 'vitest';
import { parseEnv, productionViolations } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  WEB_QR_BASE_URL: 'http://localhost:3000',
  MERCHANT_PANEL_BASE_URL: 'http://localhost:3001',
  JWT_SECRET: 'x'.repeat(32),
  QR_HMAC_SECRET: 'y'.repeat(32),
  PII_ENCRYPTION_KEY: 'z'.repeat(32),
  FAKE_PSP_WEBHOOK_SECRET: 'w'.repeat(32),
  PAYMENT_STATUS_SECRET: 'v'.repeat(32),
  INTERNAL_PROXY_SECRET: 'u'.repeat(32),
  INTERNAL_SERVICE_SECRET: 'v'.repeat(32),
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

  it('impide desactivar los límites de peticiones en producción', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', RATE_LIMITS: 'off' })).toThrow(
      /RATE_LIMITS=off no está permitido en producción/,
    );
    expect(parseEnv({ ...base, NODE_ENV: 'test', RATE_LIMITS: 'off' }).RATE_LIMITS).toBe('off');
  });

  it('en producción exige SQS y no deja crear colas desde la app (ADR-026)', () => {
    const real = {
      PAYMENT_PROVIDER: 'stripe',
      POS_CONNECTOR: 'manual',
      OTP_SENDER: 'console',
      STORAGE_DRIVER: 'local',
      AUTH_PROVIDER: 'local',
      RATE_LIMITS: 'on',
    } as const;
    const queueRules = (v: string[]) => v.filter((m) => !m.startsWith('Proveedores simulados'));
    expect(
      queueRules(productionViolations({ ...real, QUEUE_DRIVER: 'sqs', SQS_CREATE_QUEUES: 'off' })),
    ).toEqual([]);
    expect(
      queueRules(
        productionViolations({ ...real, QUEUE_DRIVER: 'bullmq', SQS_CREATE_QUEUES: 'off' }),
      ),
    ).toEqual([expect.stringMatching(/QUEUE_DRIVER=sqs/)]);
    expect(
      queueRules(productionViolations({ ...real, QUEUE_DRIVER: 'sqs', SQS_CREATE_QUEUES: 'on' })),
    ).toEqual([expect.stringMatching(/SQS_CREATE_QUEUES=on/)]);
  });

  it('exige secretos de al menos 32 caracteres', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });
});
