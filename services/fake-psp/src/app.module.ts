import { Global, Module } from '@nestjs/common';
import { HealthController, QueueModule, RedisModule } from '@comercechat/service-kit';
import { ENV, loadEnv } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { FakePspController } from './fake-psp.controller.js';
import { FakePspService } from './fake-psp.service.js';
import { FakePspInternalController } from './internal.controller.js';

@Global()
@Module({ providers: [{ provide: ENV, useFactory: loadEnv }], exports: [ENV] })
class ConfigModule {}

/** PSP simulado (ARCHITECTURE §16.3): hace de sistema externo; nunca en producción (ADR-018). */
@Module({
  imports: [ConfigModule, DbModule, RedisModule, QueueModule],
  controllers: [FakePspController, FakePspInternalController, HealthController],
  providers: [FakePspService],
})
export class AppModule {}
