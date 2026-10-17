import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LocationView } from '@comercechat/shared-types';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard } from '../auth/merchant-auth.guard.js';
import { VenuesService } from './venues.service.js';

@ApiTags('merchant-venues')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/locations')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'Locales del comercio con sus mesas y QR activos' })
  list(@CurrentMerchant() principal: MerchantPrincipal): Promise<LocationView[]> {
    return this.venues.listLocations(principal.merchantId);
  }
}
