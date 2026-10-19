import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { bearerToken } from '../common/bearer.js';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type {
  LoginResponse,
  MerchantLoginResult,
  MfaActivateResponse,
  MfaSetupResponse,
} from '@comercechat/shared-types';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { ClientIp } from '../common/client-ip.js';
import { RATE_LIMITS } from '../common/throttling.js';
import { AuthService } from './auth.service.js';
import { MerchantMfaService } from './merchant-mfa.service.js';

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

class MfaTokenDto {
  @ApiProperty({ description: 'Token del paso anterior (login o registro)' })
  @IsString()
  @MaxLength(2000)
  mfaToken: string;
}

class MfaCodeDto extends MfaTokenDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  code: string;
}

class MfaVerifyDto extends MfaTokenDto {
  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  code?: string;

  @ApiProperty({ required: false, description: 'Código de recuperación (si no hay móvil)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  recoveryCode?: string;
}

class LoginResponseDto implements LoginResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'Segundos hasta que caduca el token' }) expiresIn: number;
}

@ApiTags('merchant-auth')
@Controller('merchant/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MerchantMfaService,
  ) {}

  @Post('login')
  @Throttle({ default: RATE_LIMITS.merchantLogin })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicio de sesión de un usuario del comercio',
    description:
      'OWNER y MANAGER (y quien lo tenga activado) reciben `MFA_REQUIRED` o `MFA_SETUP_REQUIRED` con un `mfaToken` en lugar de la sesión (ADR-025).',
  })
  login(@Body() dto: MerchantLoginDto, @ClientIp() ip: string): Promise<MerchantLoginResult> {
    return this.auth.loginMerchant(dto.email, dto.password, ip);
  }

  @Post('mfa/setup')
  @Throttle({ default: RATE_LIMITS.merchantMfa })
  @HttpCode(200)
  @ApiOperation({ summary: 'Genera el secreto para la app de autenticación (paso 1 del alta)' })
  setup(@Body() dto: MfaTokenDto): Promise<MfaSetupResponse> {
    return this.mfa.setup(dto.mfaToken);
  }

  @Post('mfa/activate')
  @Throttle({ default: RATE_LIMITS.merchantMfa })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirma el secreto con un código, activa el doble factor e inicia sesión',
  })
  async activate(@Body() dto: MfaCodeDto, @ClientIp() ip: string): Promise<MfaActivateResponse> {
    const { principal, recoveryCodes } = await this.mfa.activate(dto.mfaToken, dto.code, ip);
    return { ...(await this.auth.issueSession(principal, ip)), recoveryCodes };
  }

  @Post('mfa/verify')
  @Throttle({ default: RATE_LIMITS.merchantMfa })
  @HttpCode(200)
  @ApiOperation({ summary: 'Segundo paso del login: código de la app o de recuperación' })
  @ApiOkResponse({ type: LoginResponseDto })
  async verify(@Body() dto: MfaVerifyDto, @ClientIp() ip: string): Promise<LoginResponse> {
    const principal = await this.mfa.verify(
      dto.mfaToken,
      { code: dto.code, recoveryCode: dto.recoveryCode },
      ip,
    );
    return this.auth.issueSession(principal, ip);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra la sesión: el token deja de valer aunque no haya caducado' })
  async logout(@Headers('authorization') authorization: string | undefined): Promise<void> {
    const token = bearerToken(authorization);
    if (token) await this.auth.revokeMerchantToken(token);
  }
}
