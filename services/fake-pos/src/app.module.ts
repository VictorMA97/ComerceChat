import { Global, Module } from '@nestjs/common';
import { MERCHANT_SESSION_VERIFIER, HttpMerchantSessionVerifier } from '@comercechat/auth-client';
import {
  HealthController,
  type InternalHttpClient,
  RealtimePublisherModule,
  RedisModule,
} from '@comercechat/service-kit';
import { API_CLIENT, apiClientProvider, PaymentsClient, VenuesClient } from './api-clients.js';
import { ENV, loadEnv } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { FakePosController } from './fake-pos.controller.js';
import { FakePosService } from './fake-pos.service.js';
import { FakePosInternalController } from './internal.controller.js';

@Global()
@Module({ providers: [{ provide: ENV, useFactory: loadEnv }], exports: [ENV] })
class ConfigModule {}

/**
 * Software de caja simulado (ARCHITECTURE §16.3), como servicio aparte (MS F3): la «pantalla del
 * TPV» del panel y la interfaz de caja que llama la API. Nunca en producción (ADR-018).
 */
@Module({
  imports: [ConfigModule, DbModule, RedisModule, RealtimePublisherModule],
  controllers: [FakePosController, FakePosInternalController, HealthController],
  providers: [
    FakePosService,
    apiClientProvider,
    VenuesClient,
    PaymentsClient,
    // El panel llama con la sesión del comercio: se valida en identity por HTTP.
    {
      provide: MERCHANT_SESSION_VERIFIER,
      inject: [API_CLIENT],
      useFactory: (api: InternalHttpClient) => new HttpMerchantSessionVerifier(api),
    },
  ],
})
export class AppModule {}
