import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './identity/auth/auth.module.js';
import { ThrottlingModule } from './common/throttling.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { MerchantsModule } from './merchant-venues/merchants/merchants.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { PaymentsModule } from './table-payments/payments/payments.module.js';
import { PosModule } from './pos/pos.module.js';
import { QrModule } from './merchant-venues/qr/qr.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TablesModule } from './table-payments/tables/tables.module.js';
import { UsersModule } from './identity/users/users.module.js';
import { VenuesModule } from './merchant-venues/venues/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    ThrottlingModule,
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
