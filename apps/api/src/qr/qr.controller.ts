import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ClientIp } from '../common/client-ip.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { QrResolution, TableQr } from '@comercechat/shared-types';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard, MerchantRoles } from '../auth/merchant-auth.guard.js';
import { QrService } from './qr.service.js';

@ApiTags('qr')
@Controller('qr')
export class PublicQrController {
  constructor(private readonly qr: QrService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Resuelve un QR y devuelve la identidad del comercio (público)' })
  resolve(@Param('code') code: string): Promise<QrResolution> {
    return this.qr.resolve(code);
  }
}

@ApiTags('merchant-qr')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/tables')
export class MerchantQrController {
  constructor(private readonly qr: QrService) {}

  @Post(':tableId/qr/regenerate')
  @MerchantRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Revoca el QR de la mesa y genera uno nuevo (FR-QR-05)' })
  regenerate(
    @CurrentMerchant() principal: MerchantPrincipal,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
    @ClientIp() ip: string,
  ): Promise<TableQr> {
    return this.qr.regenerateTableQr(principal, tableId, ip);
  }
}
