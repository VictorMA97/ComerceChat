import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Un único .env.local en la raíz del monorepo para todas las apps (ARCHITECTURE §16.5).
// No se usa @next/env: Next ya lo ha ejecutado para esta carpeta y no recarga otro directorio.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = join(repoRoot, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const nextConfig: NextConfig = {
  transpilePackages: ['@comercechat/shared-types', '@comercechat/api-client'],
  turbopack: { root: repoRoot },
};

export default nextConfig;
