import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
// Subruta sin Nest: main.ts carga esta configuración antes de arrancar la telemetría (ADR-027).
import { baseEnvSchema } from '@comercechat/service-kit/config';
import { z } from 'zod';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Configuración del software de caja simulado: la común (service-kit) más la suya. */
const envSchema = baseEnvSchema.extend({
  FAKE_POS_PORT: z.coerce.number().int().positive().default(4109),
  /**
   * Rutas /v1/internal/* de la API: sesiones del panel (identity), locales y mesas
   * (merchant-venues) y QR de cobro (table-payments). Hasta separarlos, los tres son apps/api.
   */
  API_INTERNAL_URL: z.string().url().default('http://localhost:4100'),
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
      throw new Error(
        `Configuración inválida del software de caja simulado:\n${issues.join('\n')}`,
      );
    }
    if (result.data.NODE_ENV === 'production') {
      throw new Error(
        'El software de caja simulado no puede arrancar con NODE_ENV=production (ADR-018)',
      );
    }
    cached = result.data;
  }
  return cached;
}
