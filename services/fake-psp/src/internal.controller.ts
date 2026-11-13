import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalAuthGuard } from '@comercechat/service-kit';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsString, IsUrl, IsUUID, Min } from 'class-validator';
import { FakePspService } from './fake-psp.service.js';

class CreateSessionDto {
  @IsUUID() paymentId: string;
  @IsString() merchantName: string;
  @IsString() statementDescriptor: string;
  @IsInt() @Min(0) amountCents: number;
  @IsInt() @Min(0) platformFeeCents: number;
  @IsUrl({ require_tld: false }) returnUrl: string;
  /** URL del webhook de esta sesión (POST /v1/webhooks/psp/fake de la API). */
  @IsUrl({ require_tld: false }) notifyUrl: string;
  @Type(() => Date) @IsDate() expiresAt: Date;
}

/** Lo que llama el adaptador FakePaymentProvider de table-payments (MIGRACION §3.3). */
@ApiExcludeController()
@UseGuards(InternalAuthGuard)
@Controller('internal/psp/sessions')
export class FakePspInternalController {
  constructor(private readonly psp: FakePspService) {}

  @Post()
  async create(@Body() dto: CreateSessionDto): Promise<{ sessionId: string }> {
    return { sessionId: await this.psp.createSession(dto) };
  }

  @Post(':id/cancel')
  @HttpCode(204)
  cancel(@Param('id') id: string): Promise<void> {
    return this.psp.cancel(id);
  }
}
