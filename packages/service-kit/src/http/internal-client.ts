import { HttpStatus } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { traceCarrier } from '../queue/trace-context.js';
import { INTERNAL_SECRET_HEADER } from './internal-auth.guard.js';

/** El otro servicio no responde (caído, sin arrancar o fuera de tiempo). */
export class ServiceUnavailableError extends AppError {
  constructor(
    readonly service: string,
    cause?: unknown,
  ) {
    super('SERVICE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE, 'Servicio no disponible');
    this.cause = cause;
  }
}

/**
 * Cliente de las rutas `/v1/internal/*` de otro servicio (MIGRACION §3.3). Envía el secreto
 * compartido y el contexto de traza (`traceparent`, ADR-027: `fetch` no lo propaga solo), con
 * un tiempo máximo por llamada. Un error del otro servicio llega como `AppError` con su `code`
 * y su estado; si no responde, `ServiceUnavailableError`.
 */
export class InternalHttpClient {
  constructor(
    /** Nombre del servicio, para los mensajes de error y los logs. */
    private readonly service: string,
    private readonly baseUrl: string,
    private readonly secret: string,
    private readonly timeoutMs = 5_000,
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          [INTERNAL_SECRET_HEADER]: this.secret,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...traceCarrier(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ServiceUnavailableError(this.service, err);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const p = (json ?? {}) as { code?: string; title?: string; detail?: string };
      if (res.status >= 502 && !p.code) throw new ServiceUnavailableError(this.service);
      throw new AppError(
        p.code ?? 'INTERNAL_ERROR',
        res.status,
        p.title ?? `Error en ${this.service}`,
        p.detail,
      );
    }
    return json as T;
  }
}
