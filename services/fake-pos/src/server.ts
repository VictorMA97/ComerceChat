import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from '@comercechat/service-kit';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

/** Crea la app (sin escuchar). La usan `main.ts` y los tests de la API, que la levantan en proceso. */
export async function createFakePosApp(opts: { logger?: false } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: opts.logger });
  configureApp(app, loadEnv(), {
    title: 'Software de caja simulado',
    description:
      'Simulador del software de caja de la PoC (ARCHITECTURE §16.3). Nunca en producción.',
  });
  return app;
}

export async function startServer(): Promise<void> {
  const app = await createFakePosApp();
  const port = loadEnv().FAKE_POS_PORT;
  await app.listen(port);
  Logger.log(`Software de caja simulado en http://localhost:${port}/v1`, 'Bootstrap');
}
