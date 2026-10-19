import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Un único .env.local en la raíz del monorepo para todas las apps (ARCHITECTURE §16.5).
// No se usa @next/env: Next ya lo ha ejecutado para esta carpeta y no recarga otro directorio.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = join(repoRoot, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Cabeceras de seguridad (OWASP A05). Sin `script-src`: Next necesita scripts inline salvo que se use
// un nonce desde `proxy` (pendiente para M0, junto con `form-action` y el origen del PSP real).
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Las URLs de pago llevan el token de estado (`?t=`): que no viaje en el Referer a otros sitios.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: ['@comercechat/shared-types', '@comercechat/api-client'],
  turbopack: { root: repoRoot },
};

export default nextConfig;
