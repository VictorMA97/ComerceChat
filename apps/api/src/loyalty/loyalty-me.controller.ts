import { CurrentUserId, UserAuthGuard } from '@comercechat/auth-client';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { ClaimPointsResponse, CouponView, LoyaltyView } from '@comercechat/shared-types';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsUUID, Length } from 'class-validator';
import { RATE_LIMITS } from '@comercechat/service-kit';
import { LoyaltyService } from './loyalty.service.js';

class ClaimDto {
  @ApiProperty() @IsUUID() paymentId: string;
  @ApiProperty() @IsString() @Length(10, 64) statusToken: string;
}

/** Puntos y recompensas del comensal (FR-LOY-*, FR-USR-02). */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('me')
export class LoyaltyMeController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('loyalty')
  @ApiOperation({ summary: 'Puntos y recompensas por comercio' })
  loyaltyView(@CurrentUserId() userId: string): Promise<LoyaltyView[]> {
    return this.loyalty.view(userId);
  }

  @Post('rewards/:id/redeem')
  @Throttle({ default: RATE_LIMITS.redeem })
  @ApiOperation({
    summary: 'Canjea puntos por una recompensa: emite un cupón de un solo uso (FR-LOY-03)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  redeem(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<CouponView> {
    return this.loyalty.redeemReward(userId, id, idempotencyKey);
  }

  @Post('claim')
  @Throttle({ default: RATE_LIMITS.redeem })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reclama los puntos de un pago hecho sin cuenta, en las 24 h siguientes (FR-USR-02)',
  })
  claim(@CurrentUserId() userId: string, @Body() dto: ClaimDto): Promise<ClaimPointsResponse> {
    return this.loyalty.claim(userId, dto.paymentId, dto.statusToken);
  }
}
