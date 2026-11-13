import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { FakeCheckoutOutcome, FakeCheckoutSession } from '@comercechat/shared-types';
import { IsIn } from 'class-validator';
import { FakePspService } from './fake-psp.service.js';

class CompleteDto {
  @ApiProperty({ enum: ['succeed', 'decline', 'fail_3ds'] })
  @IsIn(['succeed', 'decline', 'fail_3ds'])
  outcome: FakeCheckoutOutcome;
}

/** API de la página de pago del PSP simulado (la usa web-qr en /fake-psp/checkout). */
@ApiTags('fake-psp (simulador)')
@Controller('fake-psp/sessions')
export class FakePspController {
  constructor(private readonly psp: FakePspService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Datos de la sesión de pago simulada' })
  view(@Param('id') id: string): Promise<FakeCheckoutSession> {
    return this.psp.view(id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simula el resultado del pago y envía el webhook firmado' })
  complete(@Param('id') id: string, @Body() dto: CompleteDto): Promise<{ returnUrl: string }> {
    return this.psp.complete(id, dto.outcome);
  }
}
