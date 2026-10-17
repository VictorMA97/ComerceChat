import { Module } from '@nestjs/common';
import { MerchantQrController, PublicQrController } from './qr.controller.js';
import { QrService } from './qr.service.js';

@Module({
  controllers: [PublicQrController, MerchantQrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
