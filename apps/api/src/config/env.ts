import { existsSync, readFileSync } from 'node:fs';
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
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  /** all = HTTP + workers en el mismo proceso (PoC); http / worker para separarlos (ARCHITECTURE §2). */
  PROCESS_ROLE: z.enum(['all', 'http', 'worker']).default('all'),
  /** Prefijo de las colas en Redis: permite que los tests no compartan colas con `pnpm dev`. */
  QUEUE_PREFIX: z.string().min(1).default('cc'),
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
  /** Sesión del comensal en la web QR (PoC: 30 días, sin token de renovación). */
  JWT_USER_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),
  JWT_MERCHANT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 60 * 60),
  QR_HMAC_SECRET: secret,
  /** Clave Ed25519 (PKCS#8 DER, base64url) para firmar los QR dinámicos. */
  QR_SIGNING_KEY: z.string().min(40, 'falta QR_SIGNING_KEY (ejecuta pnpm poc:keys)'),
  PII_ENCRYPTION_KEY: secret,
  FAKE_PSP_WEBHOOK_SECRET: secret,
  /** Modo caos del PSP simulado: webhooks retrasados, duplicados y desordenados (ARCHITECTURE §16.3). */
  FAKE_PSP_CHAOS: z.enum(['on', 'off']).default('off'),
  // Comisión de plataforma (FR-PAY-10). Valores provisionales hasta cerrar D-05.
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(50),
  PLATFORM_FEE_FIXED_CENTS: z.coerce.number().int().min(0).default(0),
  /** Importe máximo por pago sin cuenta de usuario (FR-PAY-09). */
  GUEST_MAX_PAYMENT_CENTS: z.coerce.number().int().positive().default(30_000),
  PAYMENT_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  /** Vida de un QR dinámico de mostrador (FR-QR-03: 5 min, configurable a 10). */
  DYNAMIC_QR_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(600)
    .default(5 * 60),
});

export type Env = z.infer<typeof envSchema>;

/** Valida el entorno. Lanza un error si falta algo o si hay simuladores activos en producción. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
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

const envLocalFile = join(repoRoot, '.env.local');
let cached: Env | undefined;

/** Carga .env.local de la raíz del monorepo (si existe) y devuelve el entorno validado. */
export function loadEnv(): Env {
  if (!cached) {
    if (existsSync(envLocalFile)) loadDotenv({ path: envLocalFile, quiet: true });
    cached = parseEnv(process.env);
  }
  return cached;
}

const WEB_QR_REFRESH_MS = 2_000;
let webQrBase: { readAt: number; url: string } | undefined;

/**
 * URL pública de la web QR. Fuera de producción se relee de .env.local (como mucho cada 2 s) para que
 * `pnpm poc:tunnel`, cuya URL cambia si el túnel se reinicia, no obligue a reiniciar la API.
 * No se usa el mtime: dos escrituras seguidas pueden compartirlo por la resolución del reloj.
 */
export function webQrBaseUrl(env: Env): string {
  if (env.NODE_ENV === 'production') return env.WEB_QR_BASE_URL;
  const now = Date.now();
  if (!webQrBase || now - webQrBase.readAt > WEB_QR_REFRESH_MS) {
    let url: string | undefined;
    try {
      url = /^WEB_QR_BASE_URL=(.+)$/m.exec(readFileSync(envLocalFile, 'utf8'))?.[1]?.trim();
    } catch {
      // Sin .env.local: se usa el valor del arranque.
    }
    webQrBase = { readAt: now, url: url && URL.canParse(url) ? url : env.WEB_QR_BASE_URL };
  }
  return webQrBase.url;
}

export const ENV = Symbol('ENV');
