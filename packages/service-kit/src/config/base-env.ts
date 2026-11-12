import { z } from 'zod';

/** Secreto de al menos 32 caracteres (los genera `pnpm poc:keys`). */
export const secret = z
  .string()
  .min(32, 'debe tener al menos 32 caracteres (ejecuta pnpm poc:keys)');

/**
 * Configuración que necesita cualquier servicio (ADR-029): base de datos, Redis, colas, telemetría y
 * límites de peticiones. Cada servicio la amplía con `baseEnvSchema.extend({...})` y la valida al
 * arrancar; los módulos de este paquete la reciben con el token `ENV`.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** Puerto HTTP del servicio. Se le llama a través del gateway (:4000, ADR-030). */
  API_PORT: z.coerce.number().int().positive().default(4100),
  /** all = HTTP + workers en el mismo proceso (PoC); http / worker para separarlos (ARCHITECTURE §2). */
  PROCESS_ROLE: z.enum(['all', 'http', 'worker']).default('all'),
  /** Prefijo de las colas en Redis: permite que los tests no compartan colas con `pnpm dev`. */
  QUEUE_PREFIX: z.string().min(1).default('cc'),
  /** Colas de trabajo: BullMQ sobre Redis (PoC) o SQS (MVP). Las tareas periódicas siguen en BullMQ. */
  QUEUE_DRIVER: z.enum(['bullmq', 'sqs']).default('bullmq'),
  AWS_REGION: z.string().min(1).default('eu-south-2'),
  /** Endpoint de SQS compatible en local (ElasticMQ: http://localhost:9324). Vacío = AWS. */
  SQS_ENDPOINT: z.string().url().optional(),
  /** Crea las colas y sus DLQ si faltan. Solo local: en la nube las crea la infraestructura. */
  SQS_CREATE_QUEUES: z.enum(['on', 'off']).default('off'),
  /** Espera máxima de cada ReceiveMessage (long polling, 0–20 s). */
  SQS_WAIT_SECONDS: z.coerce.number().int().min(0).max(20).default(20),
  TELEMETRY: z.enum(['on', 'off']).default('off'),
  /** Límites de peticiones por IP. `off` solo para los tests E2E; prohibido en producción. */
  RATE_LIMITS: z.enum(['on', 'off']).default('on'),
  /**
   * Lo envían las apps Next (que son quienes llaman a la API, ADR-021) junto con la IP del cliente:
   * sin él, la API solo vería la IP del servidor de Next y los límites por IP no servirían.
   */
  INTERNAL_PROXY_SECRET: secret,
});

export type Env = z.infer<typeof baseEnvSchema>;

/** Reglas de producción comunes a todos los servicios. Un mensaje por cada una que se incumple. */
export function baseProductionViolations(
  env: Pick<Env, 'RATE_LIMITS' | 'QUEUE_DRIVER' | 'SQS_CREATE_QUEUES'>,
): string[] {
  const out: string[] = [];
  if (env.RATE_LIMITS === 'off') out.push('RATE_LIMITS=off no está permitido en producción');
  if (env.QUEUE_DRIVER !== 'sqs') {
    out.push('En producción las colas van en SQS (QUEUE_DRIVER=sqs, ADR-026)');
  }
  if (env.SQS_CREATE_QUEUES === 'on') {
    out.push(
      'SQS_CREATE_QUEUES=on no está permitido en producción: las colas las crea la infraestructura',
    );
  }
  return out;
}

/** Token de inyección de la configuración validada del servicio. */
export const ENV = Symbol('ENV');
