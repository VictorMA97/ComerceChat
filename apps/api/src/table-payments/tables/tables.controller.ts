import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DynamicQrView, FloorView, TableBill } from '@comercechat/shared-types';
import { AppError } from '../../common/app-error.js';
import {
  CurrentMerchant,
  MerchantAuthGuard,
  type MerchantPrincipal,
} from '../../identity/public/session.js';
import { VenuesDirectory } from '../../merchant-venues/public/venues-directory.js';
import { DynamicQrService } from '../dynamic-qr/dynamic-qr.service.js';
import { FloorService } from './floor.service.js';
import { TableBillService } from './table-bill.service.js';

@ApiTags('qr')
@Controller('qr')
export class TableBillController {
  constructor(private readonly bills: TableBillService) {}

  @Get(':code/bill')
  @ApiOperation({
    summary: 'Cuenta de la mesa del QR, con lo pendiente y lo reservado (FR-ORD-01, público)',
  })
  bill(@Param('code') code: string): Promise<TableBill> {
    return this.bills.view(code);
  }
}

@ApiTags('merchant-floor')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant')
export class FloorController {
  constructor(
    private readonly floorService: FloorService,
    private readonly bills: TableBillService,
    private readonly dynamicQr: DynamicQrService,
    private readonly venues: VenuesDirectory,
  ) {}

  @Post('tables/:tableId/payment-qr')
  @ApiOperation({
    summary:
      'Genera desde la caja un QR de cobro de un solo uso por lo que queda por pagar en la mesa (FR-QR-03)',
  })
  async paymentQr(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
  ): Promise<DynamicQrView> {
    const place = await this.venues.tablePlace(tableId);
    if (place?.merchant.id !== p.merchantId)
      throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');
    const ctx = await this.bills.contextForTable(tableId);
    const state = await this.bills.state(ctx);
    if (!state || state.pendingCents <= 0) {
      throw new AppError(
        'NOTHING_TO_PAY',
        HttpStatus.CONFLICT,
        'Esta mesa no tiene nada pendiente de pago',
      );
    }
    if (state.availableCents <= 0) {
      throw new AppError(
        'PAYMENT_IN_PROGRESS',
        HttpStatus.CONFLICT,
        'Los comensales están pagando lo que queda desde sus móviles',
      );
    }
    return this.dynamicQr.createForTable(
      p,
      { id: tableId, locationId: ctx.locationId },
      state.availableCents,
    );
  }

  @Get('floor')
  @ApiOperation({ summary: 'Vista de sala: estado de cada mesa y propinas del día (FR-MER-08)' })
  floor(@CurrentMerchant() p: MerchantPrincipal): Promise<FloorView[]> {
    return this.floorService.floor(p.merchantId);
  }
}
