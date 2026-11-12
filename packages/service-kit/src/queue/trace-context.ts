import { type Context, context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';

/** Contexto de traza W3C serializado para viajar con un trabajo de cola o un evento del outbox. */
export type TraceCarrier = Record<string, string>;

/** Solo identificadores de traza: nada de baggage, que podría llevar datos (ADR-027). */
const KEYS = new Set(['traceparent', 'tracestate']);

/**
 * Contexto de traza de `ctx` (por defecto, el activo). `undefined` si no hay traza, p. ej. con
 * `TELEMETRY=off`, donde la API de OpenTelemetry no inyecta nada.
 */
export function traceCarrier(ctx: Context = context.active()): TraceCarrier | undefined {
  const carrier: TraceCarrier = {};
  propagation.inject(ctx, carrier);
  const kept = Object.entries(carrier).filter(([k]) => KEYS.has(k));
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/** Contexto padre a partir de lo que trajo el mensaje; `undefined` si no trajo nada. */
export function contextFrom(carrier: TraceCarrier | undefined | null): Context | undefined {
  return carrier ? propagation.extract(ROOT_CONTEXT, carrier) : undefined;
}
