import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { FakeCheckoutOutcome, FakeCheckoutSession } from '@comercechat/shared-types';
import { IsIn } from 'class-validator';
import { AppError } from '../../common/app-error.js';
import { ENV, type Env } from '../../config/env.js';
import { FakePspService } from './fake-psp.service.js';

class CompleteDto {
  @ApiProperty({ enum: ['succeed', 'decline', 'fail_3ds'] })
  @IsIn(['succeed', 'decline', 'fail_3ds'])
  outcome: FakeCheckoutOutcome;
}

/** API de la página de pago del PSP simulado (la usa web-qr en /fake-psp/checkout). Solo con PAYMENT_PROVIDER=fake. */
@ApiTags('fake-psp (simulador)')
@Controller('fake-psp/sessions')
export class FakePspController {
  constructor(
    private readonly psp: FakePspService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Datos de la sesión de pago simulada' })
  view(@Param('id') id: string): Promise<FakeCheckoutSession> {
    this.assertEnabled();
    return this.psp.view(id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simula el resultado del pago y envía el webhook firmado' })
  complete(@Param('id') id: string, @Body() dto: CompleteDto): Promise<{ returnUrl: string }> {
    this.assertEnabled();
    return this.psp.complete(id, dto.outcome);
  }

  private assertEnabled(): void {
    if (this.env.PAYMENT_PROVIDER !== 'fake') {
      throw new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, 'PSP simulado desactivado');
    }
  }
}
