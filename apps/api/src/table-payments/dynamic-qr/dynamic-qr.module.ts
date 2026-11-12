import { Module } from '@nestjs/common';
import { MerchantDynamicQrController, PublicDynamicQrController } from './dynamic-qr.controller.js';
import { DynamicQrService } from './dynamic-qr.service.js';

/** QR de cobro que se genera desde la caja para una mesa (FR-QR-03, ADR-023). */
@Module({
  controllers: [PublicDynamicQrController, MerchantDynamicQrController],
  providers: [DynamicQrService],
  exports: [DynamicQrService],
})
export class DynamicQrModule {}
