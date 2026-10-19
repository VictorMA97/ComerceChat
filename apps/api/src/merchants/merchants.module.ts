import { Module } from '@nestjs/common';
import { MerchantAuditController } from './audit.controller.js';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsService } from './merchants.service.js';

@Module({
  controllers: [MerchantsController, MerchantAuditController],
  providers: [MerchantsService],
})
export class MerchantsModule {}
