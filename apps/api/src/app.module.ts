import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { MerchantsModule } from './merchants/merchants.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PosModule } from './pos/pos.module.js';
import { QrModule } from './qr/qr.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TablesModule } from './tables/tables.module.js';
import { UsersModule } from './users/users.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    QueueModule,
    RealtimeModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    MerchantsModule,
    VenuesModule,
    QrModule,
    PosModule,
    TablesModule,
    PaymentsModule,
    UsersModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
