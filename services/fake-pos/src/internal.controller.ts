import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { PosBill } from '@comercechat/pos-connectors';
import { InternalAuthGuard } from '@comercechat/service-kit';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { FakePosService } from './fake-pos.service.js';

class PaymentDto {
  @IsInt() @Min(0) amountCents: number;
  @IsInt() @Min(0) tipCents: number;
  @IsInt() @Min(0) discountCents: number;
  @IsString() reference: string;
}

class NewTableDto {
  @IsUUID() id: string;
  @IsString() label: string;
}

class LinkTablesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => NewTableDto)
  tables: NewTableDto[];
}

/**
 * Lo que llama el adaptador FakePosHttpConnector de la API: la misma interfaz que el software de
 * caja real (PosConnector, ARCHITECTURE §6.2). Caja «caída»: 503 POS_UNAVAILABLE (FR-POS-06).
 */
@ApiExcludeController()
@UseGuards(InternalAuthGuard)
@Controller('internal/pos/locations/:locationId')
export class FakePosInternalController {
  constructor(private readonly pos: FakePosService) {}

  @Get('health')
  async health(@Param('locationId') locationId: string): Promise<{ status: 'ok' | 'down' }> {
    return { status: await this.pos.health(locationId) };
  }

  @Get('tables/:externalTableId/bill')
  async bill(
    @Param('locationId') locationId: string,
    @Param('externalTableId') externalTableId: string,
  ): Promise<{ bill: PosBill | null }> {
    return { bill: await this.pos.getOpenBill(locationId, externalTableId) };
  }

  @Post('tables/:externalTableId/payments')
  @HttpCode(200)
  registerPayment(
    @Param('locationId') locationId: string,
    @Param('externalTableId') externalTableId: string,
    @Body() dto: PaymentDto,
  ): Promise<{ billClosed: boolean }> {
    return this.pos.registerPayment(locationId, externalTableId, dto);
  }

  @Post('tables')
  @HttpCode(200)
  async linkTables(
    @Param('locationId') locationId: string,
    @Body() dto: LinkTablesDto,
  ): Promise<{ links: Record<string, string> }> {
    return { links: Object.fromEntries(await this.pos.linkNewTables(locationId, dto.tables)) };
  }
}
