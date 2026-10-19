/** Forma de una IPv4 o IPv6. La API la vuelve a validar con `net.isIP` antes de usarla. */
const looksLikeIp = (v: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || (/^[0-9a-fA-F:.]{2,45}$/.test(v) && v.includes(':'));

/** Deben coincidir con `apps/api/src/common/client-ip.ts`. */
export const PROXY_AUTH_HEADER = 'x-cc-proxy-auth';
export const CLIENT_IP_HEADER = 'x-cc-client-ip';

/**
 * IP del navegador a partir de las cabeceras que recibe el servidor de Next. Se prefiere
 * `cf-connecting-ip` (la pone Cloudflare y el origen solo acepta tráfico suyo) y, si no, la última
 * entrada de `x-forwarded-for`: la añade el proxy más cercano, mientras que las primeras las puede
 * escribir el propio cliente para cambiar de IP a voluntad.
 */
export function clientIpFrom(incoming: Pick<Headers, 'get'>): string | null {
  const candidates = [
    incoming.get('cf-connecting-ip'),
    incoming.get('x-forwarded-for')?.split(',').at(-1),
    incoming.get('x-real-ip'),
  ];
  for (const c of candidates) {
    const ip = c?.trim();
    if (ip && looksLikeIp(ip)) return ip;
  }
  return null;
}

/**
 * Cabeceras para que la API limite y audite por la IP real del cliente (ADR-021). Sin secreto no se
 * envía nada: la API usará la IP de la conexión.
 */
export function forwardedClientHeaders(
  incoming: Pick<Headers, 'get'>,
  secret: string | undefined,
): Record<string, string> {
  const ip = clientIpFrom(incoming);
  return secret && ip ? { [PROXY_AUTH_HEADER]: secret, [CLIENT_IP_HEADER]: ip } : {};
}
