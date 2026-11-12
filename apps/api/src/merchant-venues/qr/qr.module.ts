import { Module } from '@nestjs/common';
import { MerchantQrController, PublicQrController } from './qr.controller.js';
import { QrService } from './qr.service.js';

/** QR estáticos de mesa: emisión, firma, resolución y revocación (FR-QR-01, FR-QR-05). */
@Module({
  controllers: [PublicQrController, MerchantQrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
