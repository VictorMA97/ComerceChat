import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { IdempotencyModule } from '@comercechat/service-kit';
import { FakePspModule } from '../../fake-psp/public/fake-psp.js';
import { CouponsModule } from '../coupons/coupons.module.js';
import { DynamicQrModule } from '../dynamic-qr/dynamic-qr.module.js';
import { TablesModule } from '../tables/tables.module.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { PaymentEventsService } from './payment-events.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PosSyncService } from './pos-sync.service.js';
import { FakePaymentProvider } from './providers/fake-payment.provider.js';

@Module({
  imports: [TablesModule, DynamicQrModule, CouponsModule, IdempotencyModule, FakePspModule],
  controllers: [PaymentsController],
  providers: [
    FakePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV, FakePaymentProvider],
      useFactory: (env: Env, fake: FakePaymentProvider) => {
        if (env.PAYMENT_PROVIDER === 'fake') return fake;
        // StripeConnectProvider en modo de pruebas (ADR-018) llega más adelante.
        throw new Error(`PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER} aún no está implementado`);
      },
    },
    PaymentsService,
    PaymentEventsService,
    PosSyncService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
