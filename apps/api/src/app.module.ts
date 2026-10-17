import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { MerchantsModule } from './merchants/merchants.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { QrModule } from './qr/qr.module.js';
import { RedisModule } from './redis/redis.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    MerchantsModule,
    VenuesModule,
    QrModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
