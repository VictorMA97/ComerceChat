import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { LoginResponse } from '@comercechat/shared-types';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
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
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicio de sesión de un usuario del comercio' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: MerchantLoginDto, @Ip() ip: string): Promise<LoginResponse> {
    return this.auth.loginMerchant(dto.email, dto.password, ip);
  }
}
