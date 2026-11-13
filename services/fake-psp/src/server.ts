import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from '@comercechat/service-kit';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

/** Crea la app (sin escuchar). La usan `main.ts` y los tests de la API, que la levantan en proceso. */
export async function createFakePspApp(opts: { logger?: false } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: opts.logger });
  configureApp(app, loadEnv(), {
    title: 'PSP simulado',
    description: 'Simulador del PSP de la PoC (ARCHITECTURE §16.3). Nunca en producción.',
  });
  return app;
}

export async function startServer(): Promise<void> {
  const app = await createFakePspApp();
  const port = loadEnv().FAKE_PSP_PORT;
  await app.listen(port);
  Logger.log(`PSP simulado en http://localhost:${port}/v1`, 'Bootstrap');
}
