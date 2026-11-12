import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { MerchantLoginResult, MerchantMe } from '@comercechat/shared-types';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { eq } from 'drizzle-orm';
import type { MerchantPrincipal } from '../../identity/auth/auth.types.js';
import {
  CurrentMerchant,
  MerchantAuthGuard,
  MerchantRoles,
} from '../../identity/auth/merchant-auth.guard.js';
import { AppError } from '../../common/app-error.js';
import { ClientIp } from '../../common/client-ip.js';
import { RATE_LIMITS } from '../../common/throttling.js';
import { DB, type Database } from '../../db/client.js';
import { merchantUsers } from '../../identity/schema/merchant-users.js';
import { MerchantsService } from './merchants.service.js';

class RegisterMerchantDto {
  @ApiProperty({ example: 'Casa Pepe' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName: string;

  @ApiProperty({ example: 'Casa Pepe Hostelería S.L.' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName: string;

  @ApiProperty({ example: 'B12345678', description: 'NIF/CIF' })
  @Matches(/^[A-Za-z0-9]{9}$/, { message: 'El NIF/CIF tiene 9 caracteres' })
  taxId: string;

  @ApiProperty() @IsEmail() @MaxLength(200) email: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'La contraseña necesita al menos 10 caracteres' })
  @MaxLength(200)
  password: string;
}

@ApiTags('merchant')
@Controller('merchant')
export class MerchantsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly merchants: MerchantsService,
  ) {}

  @Post('auth/register')
  @Throttle({ default: RATE_LIMITS.merchantRegister })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registro de un comercio y su OWNER (FR-MER-01)',
    description: 'Devuelve `MFA_SETUP_REQUIRED`: la sesión se abre al activar el doble factor.',
  })
  register(@Body() dto: RegisterMerchantDto, @ClientIp() ip: string): Promise<MerchantLoginResult> {
    return this.merchants.register(dto, ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @ApiOperation({ summary: 'Usuario del comercio autenticado y su comercio' })
  async me(@CurrentMerchant() principal: MerchantPrincipal): Promise<MerchantMe> {
    const user = await this.db.query.merchantUsers.findFirst({
      where: eq(merchantUsers.id, principal.merchantUserId),
      with: { merchant: true },
    });
    if (!user) throw new AppError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED, 'Sesión no válida');
    return {
      merchantUserId: user.id,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      merchant: {
        id: user.merchant.id,
        brandName: user.merchant.brandName,
        status: user.merchant.status,
      },
    };
  }

  @Post('psp/onboarding/simulate')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(MerchantAuthGuard)
  @MerchantRoles('OWNER')
  @ApiOperation({ summary: 'PoC: completa el alta ante el PSP simulado y activa el comercio' })
  simulatePspOnboarding(
    @CurrentMerchant() principal: MerchantPrincipal,
    @ClientIp() ip: string,
  ): Promise<void> {
    return this.merchants.simulatePspOnboarding(principal, ip);
  }
}
