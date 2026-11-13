import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { MerchantPrincipal } from '@comercechat/auth-client';
import { InternalAuthGuard } from '@comercechat/service-kit';
import { IsString, MaxLength } from 'class-validator';
import { AuthService } from './auth.service.js';

class VerifySessionDto {
  @IsString() @MaxLength(4096) token: string;
}

/**
 * Validación de sesiones del panel para otros servicios (HttpMerchantSessionVerifier de
 * @comercechat/auth-client, MIGRACION §3.3). Mismos criterios que en proceso: rol, estado y doble
 * factor leídos al momento.
 */
@ApiExcludeController()
@UseGuards(InternalAuthGuard)
@Controller('internal/sessions')
export class IdentityInternalController {
  constructor(private readonly auth: AuthService) {}

  @Post('merchant')
  @HttpCode(200)
  async merchant(@Body() dto: VerifySessionDto): Promise<{ principal: MerchantPrincipal | null }> {
    return { principal: await this.auth.verifyMerchantToken(dto.token) };
  }
}
