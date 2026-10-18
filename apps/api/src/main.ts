import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';

// Valida el entorno antes de levantar nada: falla si hay simuladores en producción (ADR-018).
const env = loadEnv();
// rawBody: los webhooks del PSP se verifican sobre el cuerpo en bruto (ADR-015).
const app = await NestFactory.create(AppModule, { rawBody: true });
configureApp(app, env);
if (env.PROCESS_ROLE === 'worker') {
  await app.init();
  Logger.log('Proceso worker arrancado (sin HTTP)', 'Bootstrap');
} else {
  await app.listen(env.API_PORT);
  Logger.log(
    `API en http://localhost:${env.API_PORT}/v1 · Swagger en /docs · rol ${env.PROCESS_ROLE}`,
    'Bootstrap',
  );
}
