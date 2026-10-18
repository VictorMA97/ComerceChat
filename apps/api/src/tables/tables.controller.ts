import {
  Controller,
  Get,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DynamicQrView, FloorView, TableBill } from '@comercechat/shared-types';
import { and, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard } from '../auth/merchant-auth.guard.js';
import { DB, type Database } from '../db/client.js';
import { merchantLocations, tables } from '../db/schema/index.js';
import { AppError } from '../common/app-error.js';
import { DynamicQrService } from '../qr/dynamic-qr.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { FloorService } from './floor.service.js';
import { TableBillService } from './table-bill.service.js';

@ApiTags('qr')
@Controller('qr')
export class TableBillController {
  constructor(
    private readonly bills: TableBillService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get(':code/bill')
  @ApiOperation({
    summary: 'Cuenta de la mesa del QR, con lo pendiente y lo reservado (FR-ORD-01, público)',
  })
  bill(@Param('code') code: string): Promise<TableBill> {
    return this.bills.view(code);
  }

  @Sse(':code/events')
  @ApiOperation({
    summary: 'Avisos en tiempo real de la mesa (SSE): cuando llegan, se vuelve a pedir la cuenta',
  })
  async events(@Param('code') code: string): Promise<Observable<MessageEvent>> {
    const ctx = await this.bills.context(code);
    // Eventos de esta mesa o de todo el local (p. ej. caída del TPV).
    return this.realtime.stream(
      (e) =>
        e.locationId === ctx.locationId && (e.tableId === ctx.tableId || (!e.tableId && !e.qrId)),
    );
  }
}

@ApiTags('merchant-floor')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant')
export class FloorController {
  constructor(
    private readonly floorService: FloorService,
    private readonly realtime: RealtimeService,
    private readonly bills: TableBillService,
    private readonly dynamicQr: DynamicQrService,
    @Inject(DB) private readonly db: Database,
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
    const [own] = await this.db
      .select({ id: tables.id })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .where(and(eq(tables.id, tableId), eq(merchantLocations.merchantId, p.merchantId)));
    if (!own) throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');
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

  @Sse('events')
  @ApiOperation({ summary: 'Avisos en tiempo real de todos los locales del comercio (SSE)' })
  async events(@CurrentMerchant() p: MerchantPrincipal): Promise<Observable<MessageEvent>> {
    const locations = await this.db
      .select({ id: merchantLocations.id })
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, p.merchantId));
    const ids = new Set(locations.map((l) => l.id));
    return this.realtime.stream((e) => ids.has(e.locationId));
  }
}
