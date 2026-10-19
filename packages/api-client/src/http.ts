import type { ProblemDetails } from '@comercechat/shared-types';

/** Error de la API (o de la conexión con ella) en formato RFC 9457. `problem` siempre es válido. */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
    this.name = 'ApiError';
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError;

/** Tiempo máximo por defecto: un render de servidor no debe quedarse colgado esperando a la API. */
export const DEFAULT_TIMEOUT_MS = 10_000;

export interface RequestOptions extends RequestInit {
  /** Tiempo máximo de la petición en ms (por defecto `DEFAULT_TIMEOUT_MS`). */
  timeoutMs?: number;
}

const problem = (status: number, code: string, title: string): ProblemDetails => ({
  type: 'about:blank',
  title,
  status,
  code,
});

const isProblem = (body: unknown): body is ProblemDetails =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as ProblemDetails).code === 'string' &&
  typeof (body as ProblemDetails).title === 'string' &&
  typeof (body as ProblemDetails).status === 'number';

/**
 * Hace una petición JSON a la API. Cualquier fallo (red, timeout, respuesta no JSON o error HTTP sin
 * problem+json, p. ej. un 502 de un proxy) se convierte en `ApiError` con un `problem` bien formado,
 * para que las páginas solo tengan que tratar un tipo de error.
 */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers,
    });
  } catch (err) {
    // Una cancelación pedida por quien llama no es un fallo de la API.
    if (signal?.aborted) throw err;
    if (timeout.aborted) {
      throw new ApiError(
        problem(504, 'API_TIMEOUT', 'El servicio está tardando demasiado. Inténtalo de nuevo.'),
      );
    }
    throw new ApiError(
      problem(
        503,
        'API_UNREACHABLE',
        'No hemos podido conectar. Inténtalo de nuevo en unos segundos.',
      ),
    );
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new ApiError(
      problem(
        502,
        'API_BAD_RESPONSE',
        'La respuesta del servicio se ha cortado. Inténtalo de nuevo.',
      ),
    );
  }

  let body: unknown = null;
  let parsed = true;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      parsed = false;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      isProblem(body)
        ? body
        : problem(res.status, `HTTP_${res.status}`, 'Algo ha fallado. Inténtalo de nuevo.'),
    );
  }
  if (!parsed) {
    throw new ApiError(
      problem(502, 'API_BAD_RESPONSE', 'Respuesta inesperada del servicio. Inténtalo de nuevo.'),
    );
  }
  return body as T;
}
