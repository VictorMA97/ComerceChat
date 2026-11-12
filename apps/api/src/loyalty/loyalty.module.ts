import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../common/idempotency.module.js';
import { CouponsModule } from '../table-payments/coupons/coupons.module.js';
import { LoyaltyService } from './loyalty.service.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [IdempotencyModule, CouponsModule],
  controllers: [PromotionsController],
  providers: [LoyaltyService, PromotionsService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
