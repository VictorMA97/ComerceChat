import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emite los metadatos de decoradores que necesita la inyección de dependencias de Nest.
export default defineConfig({ plugins: [swc.vite({ module: { type: 'es6' } })] });
