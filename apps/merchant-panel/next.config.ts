import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Un único .env.local en la raíz del monorepo para todas las apps (ARCHITECTURE §16.5).
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  transpilePackages: ['@comercechat/shared-types'],
  turbopack: { root: repoRoot },
};

export default nextConfig;
