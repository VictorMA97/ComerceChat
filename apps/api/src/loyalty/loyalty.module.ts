import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service.js';
import { LoyaltyService } from './loyalty.service.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  controllers: [PromotionsController],
  providers: [CouponsService, LoyaltyService, PromotionsService],
  exports: [CouponsService, LoyaltyService],
})
export class LoyaltyModule {}
