import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  type RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  MAX_SPLIT_PARTS,
  type PaymentReceipt,
  type PaymentSessionResponse,
  type SplitRequest,
  type TipRequest,
} from '@comercechat/shared-types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/throttling.js';
import { CurrentUserId, OptionalUserGuard } from '../users/user-auth.js';
import type { Request } from 'express';
import { PaymentEventsService } from './payment-events.service.js';
import { PaymentsService } from './payments.service.js';

/** Reparto (FR-PAY-02). `planSplit` vuelve a comprobarlo contra la cuenta con el pedido bloqueado. */
class SplitItemDto {
  @IsString() @Length(1, 128) lineId: string;
  @IsInt() @Min(1) @Max(1000) units: number;
}

class SplitDto {
  @IsIn(['FULL', 'EQUAL', 'ITEMS', 'AMOUNT']) mode: SplitRequest['mode'];

  @ValidateIf((o: SplitDto) => o.mode === 'EQUAL')
  @IsInt()
  @Min(2)
  @Max(MAX_SPLIT_PARTS)
  parts?: number;

  @ValidateIf((o: SplitDto) => o.mode === 'EQUAL')
  @IsInt()
  @Min(1)
  shares?: number;

  @ValidateIf((o: SplitDto) => o.mode === 'ITEMS')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  items?: SplitItemDto[];

  @ValidateIf((o: SplitDto) => o.mode === 'AMOUNT')
  @IsInt()
  @Min(1)
  amountCents?: number;
}

class TipDto {
  @IsIn(['percent', 'amount']) kind: TipRequest['kind'];

  @ValidateIf((o: TipDto) => o.kind === 'percent')
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  value?: number;

  @ValidateIf((o: TipDto) => o.kind === 'amount')
  @IsInt()
  @Min(0)
  cents?: number;
}

class CreatePaymentSessionDto {
  @ApiPropertyOptional({ description: 'Código del QR de mesa escaneado' })
  @IsOptional()
  @IsString()
  @Length(4, 64)
  qrCode?: string;

  @ApiPropertyOptional({ description: 'Token del QR de cobro generado desde la caja' })
  @IsOptional()
  @IsString()
  @Length(20, 2048)
  dynamicToken?: string;

  @ApiPropertyOptional({
    description:
      '{ mode: FULL } | { mode: EQUAL, parts, shares } | { mode: ITEMS, items: [{ lineId, units }] } | { mode: AMOUNT, amountCents }',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SplitDto)
  split?: SplitRequest;

  @ApiProperty({ description: '{ kind: percent, value } | { kind: amount, cents }' })
  @IsObject()
  @ValidateNested()
  @Type(() => TipDto)
  tip: TipRequest;

  @ApiPropertyOptional({ description: 'Identificador del dispositivo del comensal' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{16,64}$/)
  guestSessionId?: string;

  @ApiPropertyOptional({
    description: 'Cupón del usuario identificado (requiere Authorization de usuario)',
  })
  @IsOptional()
  @IsUUID()
  couponId?: string;
}

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly events: PaymentEventsService,
  ) {}

  @Post('payment-sessions')
  @Throttle({ default: RATE_LIMITS.paymentSession })
  @UseGuards(OptionalUserGuard)
  @ApiOperation({
    summary: 'Crea una sesión de pago con el QR de la mesa o el QR de cobro de la caja (público)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  createSession(
    @Body() dto: CreatePaymentSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUserId() userId: string | null,
  ): Promise<PaymentSessionResponse> {
    // Con sesión de usuario, el pago queda a su nombre: puntos automáticos y cupones (P4).
    return this.paymentsService.createSession(dto, idempotencyKey, userId);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Estado y justificante del pago (requiere el token del pago)' })
  receipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('t') token: string | undefined,
  ): Promise<PaymentReceipt> {
    return this.paymentsService.receipt(id, token);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'El comensal abandona un pago sin completar y libera su parte' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('t') token: string | undefined,
  ): Promise<PaymentReceipt> {
    return this.paymentsService.cancelByPayer(id, token);
  }

  @Post('webhooks/psp/:provider')
  // El PSP reintenta y puede enviar ráfagas; la firma (no la IP) es lo que protege este endpoint.
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhooks del PSP (firma verificada sobre el cuerpo en bruto)' })
  async webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    await this.events.ingest(provider, req.rawBody, req.headers);
    return { received: true };
  }
}
