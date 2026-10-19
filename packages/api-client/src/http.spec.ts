import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestJson } from './http.js';

const URL = 'http://api.test/v1/x';

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

async function caught(p: Promise<unknown>): Promise<ApiError> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

afterEach(() => vi.unstubAllGlobals());

describe('requestJson', () => {
  it('devuelve el cuerpo JSON de una respuesta correcta', async () => {
    mockFetch(async () => Response.json({ ok: 1 }));
    await expect(requestJson(URL)).resolves.toEqual({ ok: 1 });
  });

  it('devuelve null si la respuesta correcta no tiene cuerpo', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(requestJson(URL)).resolves.toBeNull();
  });

  it('conserva el problem+json de la API', async () => {
    const problem = { type: 'x', title: 'Mesa cerrada', status: 409, code: 'TABLE_CLOSED' };
    mockFetch(async () => Response.json(problem, { status: 409 }));
    expect((await caught(requestJson(URL))).problem).toEqual(problem);
  });

  it('convierte un error con cuerpo vacío en ApiError (no TypeError)', async () => {
    mockFetch(async () => new Response(null, { status: 502 }));
    const err = await caught(requestJson(URL));
    expect(err.problem).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(err.message).toBeTruthy();
  });

  it('convierte un error con HTML de un proxy en ApiError', async () => {
    mockFetch(async () => new Response('<html>Bad gateway</html>', { status: 504 }));
    expect((await caught(requestJson(URL))).problem.code).toBe('HTTP_504');
  });

  it('rechaza una respuesta correcta que no es JSON', async () => {
    mockFetch(async () => new Response('<html></html>', { status: 200 }));
    expect((await caught(requestJson(URL))).problem.code).toBe('API_BAD_RESPONSE');
  });

  it('convierte un fallo de red en API_UNREACHABLE', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await caught(requestJson(URL))).problem).toMatchObject({
      status: 503,
      code: 'API_UNREACHABLE',
    });
  });

  it('corta la petición al superar el timeout', async () => {
    mockFetch(
      (_input, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
    );
    expect((await caught(requestJson(URL, { timeoutMs: 20 }))).problem).toMatchObject({
      status: 504,
      code: 'API_TIMEOUT',
    });
  });

  it('propaga la cancelación pedida por quien llama', async () => {
    mockFetch(
      (_input, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
    );
    const ctrl = new AbortController();
    const p = requestJson(URL, { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.not.toBeInstanceOf(ApiError);
  });

  it('envía JSON por defecto y respeta las cabeceras de quien llama', async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    await requestJson(URL, { headers: { authorization: 'Bearer t' } });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = new Headers(init.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer t');
  });
});
