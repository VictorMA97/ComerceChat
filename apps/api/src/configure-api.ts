import type { INestApplication } from '@nestjs/common';
import { configureApp } from '@comercechat/service-kit';
import type { Env } from './config/env.js';

/** Configuración HTTP de la API (servidor y tests E2E): prefijo, seguridad, errores y Swagger. */
export function configureApi(app: INestApplication, env: Env): void {
  configureApp(app, env, {
    title: 'ComerceChat API',
    description: 'API de la PoC local (ARCHITECTURE §11). Errores en formato RFC 9457.',
  });
}
