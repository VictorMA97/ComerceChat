import { Module } from '@nestjs/common';
import { DynamicQrService } from './dynamic-qr.service.js';
import { MerchantDynamicQrController, PublicDynamicQrController } from './dynamic-qr.controller.js';
import { MerchantQrController, PublicQrController } from './qr.controller.js';
import { QrService } from './qr.service.js';

@Module({
  controllers: [
    PublicDynamicQrController,
    PublicQrController,
    MerchantQrController,
    MerchantDynamicQrController,
  ],
  providers: [QrService, DynamicQrService],
  exports: [QrService, DynamicQrService],
})
export class QrModule {}
