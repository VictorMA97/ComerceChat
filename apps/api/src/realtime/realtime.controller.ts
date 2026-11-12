import { Controller, HttpStatus, type MessageEvent, Param, Sse, UseGuards } from '@nestjs/common';
import {
  CurrentMerchant,
  MerchantAuthGuard,
  type MerchantPrincipal,
} from '@comercechat/auth-client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { AppError } from '@comercechat/service-kit';
import { VenuesDirectory } from '../merchant-venues/public/venues-directory.js';
import { RealtimeService } from './realtime.service.js';

/** Avisos de una mesa para la web QR (SSE). Al recibirlos, el cliente vuelve a pedir la cuenta. */
@ApiTags('qr')
@Controller('qr')
export class TableEventsController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly venues: VenuesDirectory,
  ) {}

  @Sse(':code/events')
  @ApiOperation({
    summary: 'Avisos en tiempo real de la mesa (SSE): cuando llegan, se vuelve a pedir la cuenta',
  })
  async events(@Param('code') code: string): Promise<Observable<MessageEvent>> {
    const qr = await this.venues.resolveQr(code);
    const table = qr.table;
    if (!table) {
      throw new AppError('QR_NOT_TABLE', HttpStatus.CONFLICT, 'Este QR no corresponde a una mesa');
    }
    // Eventos de esta mesa o de todo el local (p. ej. caída del TPV).
    return this.realtime.stream(
      (e) => e.locationId === qr.location.id && (e.tableId === table.id || (!e.tableId && !e.qrId)),
    );
  }
}

/** Avisos de todos los locales del comercio para el panel (sala, simulador de caja). */
@ApiTags('merchant-floor')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant')
export class MerchantEventsController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly venues: VenuesDirectory,
  ) {}

  @Sse('events')
  @ApiOperation({ summary: 'Avisos en tiempo real de todos los locales del comercio (SSE)' })
  async events(@CurrentMerchant() p: MerchantPrincipal): Promise<Observable<MessageEvent>> {
    const ids = new Set((await this.venues.locationsOf(p.merchantId)).map((l) => l.id));
    return this.realtime.stream((e) => ids.has(e.locationId));
  }
}
