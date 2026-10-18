import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemFilter } from './common/problem.filter.js';
import { type Env, webQrBaseUrl } from './config/env.js';

/** Configuración común de la app (servidor y tests E2E). */
export function configureApp(app: INestApplication, env: Env): void {
  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || [webQrBaseUrl(env), env.MERCHANT_PANEL_BASE_URL].includes(origin)),
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('ComerceChat API')
    .setDescription('API de la PoC local (ARCHITECTURE §11). Errores en formato RFC 9457.')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs/openapi.json',
  });
}
