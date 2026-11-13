import type { ExecutionContext } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../common/app-error.js';
import type { Env } from '../config/base-env.js';
import { INTERNAL_SECRET_HEADER, InternalAuthGuard } from './internal-auth.guard.js';
import { InternalHttpClient, ServiceUnavailableError } from './internal-client.js';

const SECRET = 'i'.repeat(32);

describe('InternalHttpClient', () => {
  let server: Server;
  let url: string;
  const seen: Record<string, string | undefined> = {};

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.secret = req.headers[INTERNAL_SECRET_HEADER] as string | undefined;
      if (req.url === '/ok') {
        res.setHeader('content-type', 'application/json');
        res.end('{"value":42}');
      } else if (req.url === '/none') {
        res.statusCode = 204;
        res.end();
      } else {
        res.statusCode = 503;
        res.setHeader('content-type', 'application/problem+json');
        res.end('{"status":503,"code":"POS_UNAVAILABLE","title":"Caja caída"}');
      }
    });
    await new Promise<void>((r) => server.listen(0, r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('envía el secreto y devuelve el JSON', async () => {
    const client = new InternalHttpClient('prueba', url, SECRET);
    await expect(client.get('/ok')).resolves.toEqual({ value: 42 });
    expect(seen.secret).toBe(SECRET);
    await expect(client.post('/none', {})).resolves.toBeUndefined();
  });

  it('un problem+json del otro servicio llega como AppError con su code y su estado', async () => {
    const err = await new InternalHttpClient('prueba', url, SECRET).get('/fallo').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'POS_UNAVAILABLE' });
    expect((err as AppError).getStatus()).toBe(503);
  });

  it('si el servicio no responde, ServiceUnavailableError', async () => {
    const err = await new InternalHttpClient('caído', 'http://127.0.0.1:1', SECRET, 500)
      .get('/ok')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect(err).toMatchObject({ code: 'SERVICE_UNAVAILABLE', service: 'caído' });
  });
});

describe('InternalAuthGuard', () => {
  const ctx = (headers: Record<string, string>) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;
  const guard = new InternalAuthGuard({ INTERNAL_SERVICE_SECRET: SECRET } as Env);

  it('deja pasar solo con el secreto correcto y, si no, responde como una ruta inexistente', () => {
    expect(guard.canActivate(ctx({ [INTERNAL_SECRET_HEADER]: SECRET }))).toBe(true);
    const cases: Record<string, string>[] = [
      {},
      { [INTERNAL_SECRET_HEADER]: 'otro' },
      { [INTERNAL_SECRET_HEADER]: '' },
    ];
    for (const headers of cases) {
      expect(() => guard.canActivate(ctx(headers))).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    }
  });
});
