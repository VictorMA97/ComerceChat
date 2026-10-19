import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { loadEnv } from '../config/env.js';

/** Cabeceras con las que las apps Next reenvían la IP del navegador (ADR-021). */
export const PROXY_AUTH_HEADER = 'x-cc-proxy-auth';
export const CLIENT_IP_HEADER = 'x-cc-client-ip';

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * IP del cliente final. El navegador nunca llama a la API: llega a través del servidor de Next, que
 * reenvía la IP original con el secreto compartido. Sin ese secreto (o con una IP mal formada) solo
 * se confía en la IP de la conexión, así que nadie puede elegir su IP enviando la cabecera.
 */
export function clientIp(req: Request, proxySecret: string): string {
  const auth = req.headers[PROXY_AUTH_HEADER];
  const forwarded = req.headers[CLIENT_IP_HEADER];
  if (
    typeof auth === 'string' &&
    typeof forwarded === 'string' &&
    sameSecret(auth, proxySecret) &&
    isIP(forwarded.trim()) !== 0
  ) {
    return forwarded.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** IP del cliente final para auditoría (`@ClientIp() ip: string`). */
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string =>
  clientIp(ctx.switchToHttp().getRequest<Request>(), loadEnv().INTERNAL_PROXY_SECRET),
);
