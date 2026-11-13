// Trazas con OpenTelemetry (ROADMAP M0, ADR-027). Se carga ANTES que la app (ver main.ts): los hooks
// de ESM solo instrumentan los módulos que se importan después de registrarlos.
import { register } from 'node:module';
import type { Context } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { Env } from './config/base-env.js';

/** Atributos con URLs: pueden llevar tokens en la query (`/payments/:id?t=…`). */
const URL_ATTRIBUTES = ['url.full', 'url.query', 'http.url', 'http.target', 'http.route.query'];

/** Quita la query de una URL o ruta y deja la marca de que había una. */
export function redactQuery(value: string): string {
  const i = value.indexOf('?');
  return i === -1 ? value : `${value.slice(0, i)}?[redactado]`;
}

/**
 * Redacta atributos sensibles antes de exportar: las trazas salen del sistema (Jaeger, proveedor
 * gestionado) y no pueden llevar tokens ni datos personales (REG, ARCHITECTURE §9).
 */
export function redactAttributes(attributes: Record<string, unknown>): void {
  for (const key of URL_ATTRIBUTES) {
    const v = attributes[key];
    if (typeof v !== 'string') continue;
    attributes[key] = key === 'url.query' ? '[redactado]' : redactQuery(v);
  }
}

class RedactingSpanProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}
  onStart(span: Span, ctx: Context): void {
    this.inner.onStart(span, ctx);
  }
  onEnd(span: ReadableSpan): void {
    redactAttributes(span.attributes as Record<string, unknown>);
    this.inner.onEnd(span);
  }
  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }
  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}

/**
 * Arranca el SDK si `TELEMETRY=on`. El destino se configura con las variables estándar
 * (`OTEL_EXPORTER_OTLP_ENDPOINT`, por defecto http://localhost:4318; `OTEL_TRACES_SAMPLER`…).
 * Devuelve la función que vacía y cierra el exportador.
 */
export function startTelemetry(env: Env): () => Promise<void> {
  if (env.TELEMETRY !== 'on') return () => Promise.resolve();
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? `comercechat-api-${env.PROCESS_ROLE}`,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
      'deployment.environment.name': env.NODE_ENV,
    }),
    spanProcessors: [new RedactingSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()))],
    instrumentations: [
      new HttpInstrumentation({
        // Las sondas de salud no aportan nada y llenarían las trazas.
        ignoreIncomingRequestHook: (req) => req.url?.startsWith('/v1/health') ?? false,
        // Las salientes sin petición o trabajo que las origine (long polling de SQS) serían ruido.
        requireParentforOutgoingSpans: true,
      }),
      new ExpressInstrumentation(),
      // Sin parámetros: solo el SQL con `$1, $2…` (los valores pueden ser datos personales).
      // Solo dentro de una petición o un trabajo de cola: el sondeo del outbox (cada 300 ms) no traza.
      new PgInstrumentation({ enhancedDatabaseReporting: false, requireParentSpan: true }),
      // Solo el comando: los argumentos llevan claves con hashes y valores (secretos cifrados, códigos).
      new IORedisInstrumentation({ dbStatementSerializer: (cmd) => cmd, requireParentSpan: true }),
    ],
  });
  sdk.start();
  return () => sdk.shutdown();
}
