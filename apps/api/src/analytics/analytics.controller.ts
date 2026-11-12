import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CurrentMerchant,
  MerchantAuthGuard,
  type MerchantPrincipal,
} from '@comercechat/auth-client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AnalyticsPeriod, AnalyticsView } from '@comercechat/shared-types';
import { AnalyticsService } from './analytics.service.js';

const PERIODS: AnalyticsPeriod[] = ['today', 'week', 'month'];

@ApiTags('merchant-analytics')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiQuery({ name: 'period', enum: PERIODS, required: false })
  @ApiOperation({
    summary: 'Ventas por QR, ticket medio, propinas y clientes identificados (FR-ANA-01)',
  })
  view(
    @CurrentMerchant() m: MerchantPrincipal,
    @Query('period') period?: string,
  ): Promise<AnalyticsView> {
    return this.analytics.view(
      m.merchantId,
      PERIODS.includes(period as AnalyticsPeriod) ? (period as AnalyticsPeriod) : 'today',
    );
  }
}
