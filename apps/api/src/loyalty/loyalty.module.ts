import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../common/idempotency.module.js';
import { CouponsService } from './coupons.service.js';
import { LoyaltyService } from './loyalty.service.js';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [IdempotencyModule],
  controllers: [PromotionsController],
  providers: [CouponsService, LoyaltyService, PromotionsService],
  exports: [CouponsService, LoyaltyService],
})
export class LoyaltyModule {}
