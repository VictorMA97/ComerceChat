import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { PromotionView } from '@comercechat/shared-types';
import { IsInt, IsString, Length } from 'class-validator';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard, MerchantRoles } from '../auth/merchant-auth.guard.js';
import { PromotionsService } from './promotions.service.js';

class CreatePromotionDto {
  @ApiProperty({ example: 'Vuelve y te invitamos' }) @IsString() @Length(3, 80) name: string;
  @ApiProperty({ example: 500 }) @IsInt() discountCents: number;
  @ApiProperty({ example: 2000 }) @IsInt() minSpendCents: number;
  @ApiProperty({ example: 30 }) @IsInt() validDays: number;
}

@ApiTags('merchant-promotions')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @ApiOperation({ summary: 'Promociones del comercio con cupones emitidos y canjeados' })
  list(@CurrentMerchant() m: MerchantPrincipal): Promise<PromotionView[]> {
    return this.promotions.list(m.merchantId);
  }

  @Post()
  @MerchantRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Crea la promoción «Vuelve y te invitamos» (sustituye a la activa)' })
  create(
    @CurrentMerchant() m: MerchantPrincipal,
    @Body() dto: CreatePromotionDto,
  ): Promise<PromotionView> {
    return this.promotions.create(m, dto);
  }

  @Post(':id/end')
  @HttpCode(204)
  @MerchantRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Termina la promoción (los cupones ya emitidos siguen valiendo)' })
  end(
    @CurrentMerchant() m: MerchantPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.promotions.end(m, id);
  }
}
