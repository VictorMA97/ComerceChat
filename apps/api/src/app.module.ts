import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './identity/auth/auth.module.js';
import {
  HealthController,
  OutboxModule,
  QueueModule,
  RealtimePublisherModule,
  RedisModule,
  ThrottlingModule,
} from '@comercechat/service-kit';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { MerchantsModule } from './merchant-venues/merchants/merchants.module.js';
import { PaymentsModule } from './table-payments/payments/payments.module.js';
import { PosModule } from './pos/pos.module.js';
import { QrModule } from './merchant-venues/qr/qr.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { TablesModule } from './table-payments/tables/tables.module.js';
import { UsersModule } from './identity/users/users.module.js';
import { LoyaltyModule } from './loyalty/loyalty.module.js';
import { LoyaltyPublicModule } from './loyalty/public/loyalty-public.module.js';
import { VenuesPublicModule } from './merchant-venues/public/venues-public.module.js';
import { TablePaymentsPublicModule } from './table-payments/public/table-payments-public.module.js';
import { VenuesModule } from './merchant-venues/venues/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    ThrottlingModule,
    QueueModule,
    RealtimePublisherModule,
    RealtimeModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    VenuesPublicModule,
    TablePaymentsPublicModule,
    LoyaltyPublicModule,
    LoyaltyModule,
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
