import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Texto de un error apto para logs (y, más adelante, Sentry/OpenTelemetry). El mensaje de
 * `DrizzleQueryError` incluye la consulta y sus PARÁMETROS (hashes de teléfono, PII cifrada, ids,
 * importes): se sustituye por el código de Postgres y la restricción, y se conserva la pila.
 */
export function safeErrorForLog(err: unknown): string {
  if (err instanceof DrizzleQueryError) {
    const cause = err.cause as { code?: string; constraint?: string; table?: string } | undefined;
    const detail = [
      `pg=${cause?.code ?? '?'}`,
      cause?.table ? `table=${cause.table}` : null,
      cause?.constraint ? `constraint=${cause.constraint}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    return `DrizzleQueryError ${detail}\n${stackFrames(err)}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}\n${stackFrames(err)}`;
  return String(err);
}

/** Solo las líneas `at …` de la pila: la primera repite el mensaje. */
function stackFrames(err: Error): string {
  return (err.stack ?? '')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .join('\n');
}
