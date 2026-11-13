import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { DynamicQrView } from '@comercechat/shared-types';
import { InternalAuthGuard } from '@comercechat/service-kit';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { PaymentsDirectory } from './payments-directory.js';

class TablesDto {
  @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) tableIds: string[];
}

/** PaymentsDirectory por HTTP para otros servicios (MIGRACION §3.3). */
@ApiExcludeController()
@UseGuards(InternalAuthGuard)
@Controller('internal/payments')
export class PaymentsInternalController {
  constructor(private readonly payments: PaymentsDirectory) {}

  /** Último QR de cobro de cada mesa (simulador de caja, ADR-023). */
  @Post('payment-qrs')
  @HttpCode(200)
  async paymentQrs(@Body() dto: TablesDto): Promise<Record<string, DynamicQrView>> {
    return Object.fromEntries(await this.payments.paymentQrsForTables(dto.tableIds));
  }
}
