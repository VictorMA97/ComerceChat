import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
// Subruta sin Nest: main.ts carga esta configuración antes de arrancar la telemetría (ADR-027).
import { baseEnvSchema, secret } from '@comercechat/service-kit/config';
import { z } from 'zod';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Configuración del PSP simulado: la común (service-kit) más la suya. */
const envSchema = baseEnvSchema.extend({
  FAKE_PSP_PORT: z.coerce.number().int().positive().default(4108),
  FAKE_PSP_WEBHOOK_SECRET: secret,
  /** Modo caos: webhooks retrasados, duplicados y desordenados (ARCHITECTURE §16.3). */
  FAKE_PSP_CHAOS: z.enum(['on', 'off']).default('off'),
});

export type Env = z.infer<typeof envSchema>;
export { ENV } from '@comercechat/service-kit/config';

let cached: Env | undefined;

/** Carga .env.local de la raíz del monorepo (si existe) y devuelve el entorno validado. */
export function loadEnv(): Env {
  if (!cached) {
    const file = join(repoRoot, '.env.local');
    if (existsSync(file)) loadDotenv({ path: file, quiet: true });
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
      throw new Error(`Configuración inválida del PSP simulado:\n${issues.join('\n')}`);
    }
    if (result.data.NODE_ENV === 'production') {
      throw new Error('El PSP simulado no puede arrancar con NODE_ENV=production (ADR-018)');
    }
    cached = result.data;
  }
  return cached;
}
