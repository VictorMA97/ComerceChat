import { Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import type { Env } from './config/env.js';

/** Módulo raíz que, al apagar la app (SIGTERM en ECS), vacía las trazas pendientes. */
function rootModule(stopTelemetry: () => Promise<void>) {
  @Module({ imports: [AppModule] })
  class RootModule implements OnApplicationShutdown {
    async onApplicationShutdown(): Promise<void> {
      await stopTelemetry().catch(() => undefined);
    }
  }
  return RootModule;
}

/** Levanta la API (o solo los workers, según PROCESS_ROLE). Se importa después de la telemetría. */
export async function startServer(env: Env, stopTelemetry: () => Promise<void>): Promise<void> {
  // rawBody: los webhooks del PSP se verifican sobre el cuerpo en bruto (ADR-015).
  const app = await NestFactory.create(rootModule(stopTelemetry), { rawBody: true });
  configureApp(app, env);
  if (env.PROCESS_ROLE === 'worker') {
    await app.init();
    Logger.log('Proceso worker arrancado (sin HTTP)', 'Bootstrap');
  } else {
    await app.listen(env.API_PORT);
    Logger.log(
      `API en http://localhost:${env.API_PORT}/v1 · Swagger en /docs · rol ${env.PROCESS_ROLE}` +
        (env.TELEMETRY === 'on' ? ' · trazas OpenTelemetry activas' : ''),
      'Bootstrap',
    );
  }
}
