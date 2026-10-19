import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emite los metadatos de decoradores que necesita la inyección de dependencias de Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Los tests arrancan workers BullMQ: con un prefijo propio no compiten con los de `pnpm dev`.
    env: { QUEUE_PREFIX: `cc-test-${process.pid}` },
    projects: [
      // Sin dependencias externas: se ejecutan en el pre-push y Turbo los cachea.
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      // Postgres y Redis reales de .env.local (requieren Docker).
      { extends: true, test: { name: 'integration', include: ['test/**/*.e2e-spec.ts'] } },
    ],
  },
});
