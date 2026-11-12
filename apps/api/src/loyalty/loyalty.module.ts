import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../common/idempotency.module.js';
import { CouponIssuer } from './coupon-issuer.service.js';
import { LoyaltyMeController } from './loyalty-me.controller.js';
import { LoyaltyService } from './loyalty.service.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [IdempotencyModule],
  controllers: [PromotionsController, LoyaltyMeController],
  providers: [LoyaltyService, PromotionsService, CouponIssuer],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
