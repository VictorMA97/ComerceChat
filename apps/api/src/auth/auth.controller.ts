import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { bearerToken } from '../common/bearer.js';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { LoginResponse } from '@comercechat/shared-types';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { ClientIp } from '../common/client-ip.js';
import { RATE_LIMITS } from '../common/throttling.js';
import { AuthService } from './auth.service.js';

export class MerchantLoginDto {
  @ApiProperty({ example: 'owner@casapepe.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'poc1234' })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password: string;
}

class LoginResponseDto implements LoginResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'Segundos hasta que caduca el token' }) expiresIn: number;
}

@ApiTags('merchant-auth')
@Controller('merchant/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: RATE_LIMITS.merchantLogin })
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicio de sesión de un usuario del comercio' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: MerchantLoginDto, @ClientIp() ip: string): Promise<LoginResponse> {
    return this.auth.loginMerchant(dto.email, dto.password, ip);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra la sesión: el token deja de valer aunque no haya caducado' })
  async logout(@Headers('authorization') authorization: string | undefined): Promise<void> {
    const token = bearerToken(authorization);
    if (token) await this.auth.revokeMerchantToken(token);
  }
}
