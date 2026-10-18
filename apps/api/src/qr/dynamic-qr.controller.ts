import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DynamicQrResolution, DynamicQrView } from '@comercechat/shared-types';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard } from '../auth/merchant-auth.guard.js';
import { DynamicQrService } from './dynamic-qr.service.js';

/** El QR de cobro de una mesa se crea desde la caja: `POST /merchant/tables/:tableId/payment-qr`. */
@ApiTags('merchant-qr')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/dynamic-qr')
export class MerchantDynamicQrController {
  constructor(private readonly dynamicQr: DynamicQrService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Estado del QR de cobro y de su pago' })
  get(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DynamicQrView> {
    return this.dynamicQr.get(p, id);
  }

  @Post(':id/revoke')
  @HttpCode(204)
  @ApiOperation({ summary: 'Anula el QR de cobro' })
  revoke(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.dynamicQr.revoke(p, id);
  }
}

@ApiTags('qr')
@Controller('qr/dynamic')
export class PublicDynamicQrController {
  constructor(private readonly dynamicQr: DynamicQrService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resuelve el QR de cobro de una mesa (público)' })
  async resolve(@Param('token') token: string): Promise<DynamicQrResolution> {
    return (await this.dynamicQr.resolve(token)).resolution;
  }
}
