import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emite los metadatos de decoradores que necesita la inyección de dependencias de Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
