import { defineConfig, devices } from '@playwright/test';

// Recorrido completo de la PoC en navegador (ROADMAP §2, P4). Usa la app local: si `pnpm dev` no está
// arrancado, Playwright lo arranca. ¡Ojo! El global setup vuelve a cargar los datos de prueba.
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --dir .. dev',
    url: 'http://localhost:4000/v1/health',
    reuseExistingServer: true,
    timeout: 180_000,
    // turbo reenvía SIGINT a sus procesos hijos; con la señal por defecto quedan huérfanos.
    gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
  },
});
