import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { QrModule } from '../qr/qr.module.js';
import { TablesModule } from '../tables/tables.module.js';
import { FakePaymentProvider } from './fake-psp/fake-payment.provider.js';
import { FakePspController } from './fake-psp/fake-psp.controller.js';
import { FakePspService } from './fake-psp/fake-psp.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { PaymentEventsService } from './payment-events.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PosSyncService } from './pos-sync.service.js';

@Module({
  imports: [TablesModule, QrModule, LoyaltyModule],
  controllers: [PaymentsController, FakePspController],
  providers: [
    FakePspService,
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
    IdempotencyService,
    PaymentsService,
    PaymentEventsService,
    PosSyncService,
  ],
  exports: [PaymentsService, FakePspService],
})
export class PaymentsModule {}
