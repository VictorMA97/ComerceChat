import { Global, Module } from '@nestjs/common';
import { DynamicQrModule } from '../dynamic-qr/dynamic-qr.module.js';
import { PaymentsDirectory } from './payments-directory.js';

/** Expone `PaymentsDirectory` a toda la aplicación sin que los contextos importen módulos internos. */
@Global()
@Module({
  imports: [DynamicQrModule],
  providers: [PaymentsDirectory],
  exports: [PaymentsDirectory],
})
export class TablePaymentsPublicModule {}
