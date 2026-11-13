import { Global, Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module.js';
import { DynamicQrModule } from '../dynamic-qr/dynamic-qr.module.js';
import { PaymentsInternalController } from './internal.controller.js';
import { PaymentsDirectory } from './payments-directory.js';

/** Expone `PaymentsDirectory` a toda la aplicación sin que los contextos importen módulos internos. */
@Global()
@Module({
  imports: [DynamicQrModule, CouponsModule],
  controllers: [PaymentsInternalController],
  providers: [PaymentsDirectory],
  exports: [PaymentsDirectory],
})
export class TablePaymentsPublicModule {}
