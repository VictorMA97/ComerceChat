import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemFilter } from './problem.filter.js';
import type { Env } from '../config/base-env.js';

export interface AppDocs {
  /** Título de la especificación OpenAPI (Swagger), solo fuera de producción. */
  title: string;
  description: string;
}

/** Configuración común de un servicio HTTP (servidor y tests E2E). */
export function configureApp(app: INestApplication, env: Env, docs: AppDocs): void {
  app.setGlobalPrefix('v1');
  const isProduction = env.NODE_ENV === 'production';
  // Cabeceras de seguridad. La CSP por defecto de helmet rompe Swagger UI, que solo existe fuera de
  // producción: allí se desactiva.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  // Sin CORS: el navegador nunca llama a la API, solo los servidores de las apps Next (ADR-021).
  app.enableCors({ origin: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();

  // El contrato completo de la API no se publica en producción.
  if (isProduction) return;
  const config = new DocumentBuilder()
    .setTitle(docs.title)
    .setDescription(docs.description)
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs/openapi.json',
  });
}
