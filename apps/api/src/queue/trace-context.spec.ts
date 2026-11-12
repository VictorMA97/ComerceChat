import {
  propagation,
  ROOT_CONTEXT,
  type TextMapPropagator,
  trace,
  TraceFlags,
} from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { traced } from './queue.service.js';
import { contextFrom, traceCarrier } from './trace-context.js';

/** Propagador W3C mínimo para el test; también escribe baggage, que nunca debe viajar. */
const w3c: TextMapPropagator = {
  inject(ctx, carrier, setter) {
    const sc = trace.getSpanContext(ctx);
    if (!sc) return;
    setter.set(carrier, 'traceparent', `00-${sc.traceId}-${sc.spanId}-0${sc.traceFlags}`);
    setter.set(carrier, 'baggage', 'telefono=+34600000001');
  },
  extract(ctx, carrier, getter) {
    const value = getter.get(carrier, 'traceparent');
    if (typeof value !== 'string') return ctx;
    const [, traceId, spanId, flags] = value.split('-');
    return trace.setSpanContext(ctx, {
      traceId: traceId!,
      spanId: spanId!,
      traceFlags: Number.parseInt(flags!, 16),
      isRemote: true,
    });
  },
  fields: () => ['traceparent', 'baggage'],
};

describe('contexto de traza en los trabajos de cola (ADR-027)', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  beforeAll(() => {
    trace.setGlobalTracerProvider(provider);
    propagation.setGlobalPropagator(w3c);
  });
  afterAll(() => {
    trace.disable();
    propagation.disable();
  });

  it('sin traza activa no añade nada al mensaje', () => {
    expect(traceCarrier(ROOT_CONTEXT)).toBeUndefined();
    expect(contextFrom(undefined)).toBeUndefined();
  });

  it('el trabajo continúa la traza de quien lo encoló y no lleva baggage', async () => {
    const parent = provider.getTracer('test').startSpan('POST /v1/webhooks/psp/fake');
    const carrier = traceCarrier(trace.setSpan(ROOT_CONTEXT, parent));
    expect(carrier).toEqual({
      traceparent: `00-${parent.spanContext().traceId}-${parent.spanContext().spanId}-0${TraceFlags.SAMPLED}`,
    });

    await traced(
      'psp-events',
      'bullmq',
      async () => undefined,
    )({
      name: 'payment.succeeded',
      data: {},
      attemptsMade: 0,
      trace: carrier,
    });
    parent.end();

    const job = exporter
      .getFinishedSpans()
      .find((s) => s.name === 'process psp-events payment.succeeded');
    expect(job?.spanContext().traceId).toBe(parent.spanContext().traceId);
    expect(job?.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });
});
