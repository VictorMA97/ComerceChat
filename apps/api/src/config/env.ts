import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

// Selectores de proveedores (ARCHITECTURE §16.2). Los valores "simulados" están prohibidos en producción.
const SIMULATED_VALUES = new Set(['fake', 'console', 'local']);
const PROVIDER_SELECTORS = [
  'PAYMENT_PROVIDER',
  'POS_CONNECTOR',
  'OTP_SENDER',
  'STORAGE_DRIVER',
  'AUTH_PROVIDER',
] as const;

const secret = z.string().min(32, 'debe tener al menos 32 caracteres (ejecuta pnpm poc:keys)');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_QR_BASE_URL: z.string().url(),
  MERCHANT_PANEL_BASE_URL: z.string().url(),
  PAYMENT_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
  POS_CONNECTOR: z.enum(['fake', 'manual']).default('fake'),
  OTP_SENDER: z.enum(['console']).default('console'),
  QUEUE_DRIVER: z.enum(['bullmq']).default('bullmq'),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  AUTH_PROVIDER: z.enum(['local']).default('local'),
  TELEMETRY: z.enum(['on', 'off']).default('off'),
  JWT_SECRET: secret,
  JWT_MERCHANT_TTL_SECONDS: z.coerce.number().int().positive().default(8 * 60 * 60),
  QR_HMAC_SECRET: secret,
  PII_ENCRYPTION_KEY: secret,
  FAKE_PSP_WEBHOOK_SECRET: secret,
});

export type Env = z.infer<typeof envSchema>;

/** Valida el entorno. Lanza un error si falta algo o si hay simuladores activos en producción. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    const simulated = PROVIDER_SELECTORS.filter((key) => SIMULATED_VALUES.has(env[key]));
    if (simulated.length > 0) {
      throw new Error(
        `Proveedores simulados no permitidos en producción: ${simulated
          .map((k) => `${k}=${env[k]}`)
          .join(', ')} (ADR-018)`,
      );
    }
  }
  return env;
}

let cached: Env | undefined;

/** Carga .env.local de la raíz del monorepo (si existe) y devuelve el entorno validado. */
export function loadEnv(): Env {
  if (!cached) {
    const file = join(repoRoot, '.env.local');
    if (existsSync(file)) loadDotenv({ path: file, quiet: true });
    cached = parseEnv(process.env);
  }
  return cached;
}

export const ENV = Symbol('ENV');
