import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ClaimPointsResponse,
  ConsentsInput,
  CouponView,
  LoyaltyView,
  MeView,
  OtpStartResponse,
  UserSession,
} from '@comercechat/shared-types';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { hashPii } from '../common/pii.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Database } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { CouponsService } from '../loyalty/coupons.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { OtpService } from './otp.service.js';
import { normalizePhone } from './phone.js';
import { CurrentUserId, UserAuthGuard, UserTokens } from './user-auth.js';
import { UsersService } from './users.service.js';

class OtpStartDto {
  @ApiProperty({ example: '+34600000000' }) @IsString() @Length(6, 20) phone: string;
}

class OtpVerifyDto {
  @ApiProperty({ example: '+34600000000' }) @IsString() @Length(6, 20) phone: string;
  @ApiProperty({ example: '000000' }) @Matches(/^\d{6}$/) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 60) name?: string;
  @ApiPropertyOptional({ description: '{ terms, marketing, shareWithMerchantId? } (REG-07)' })
  @IsOptional()
  @IsObject()
  consents?: ConsentsInput;
}

class ConsentsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketing?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() merchantId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shareWithMerchant?: boolean;
}

class ClaimDto {
  @ApiProperty() @IsUUID() paymentId: string;
  @ApiProperty() @IsString() @Length(10, 64) statusToken: string;
}

const invalidPhone = () =>
  new AppError('PHONE_INVALID', HttpStatus.UNPROCESSABLE_ENTITY, 'Teléfono no válido');

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(
    private readonly otp: OtpService,
    private readonly usersService: UsersService,
    private readonly tokens: UserTokens,
    private readonly loyalty: LoyaltyService,
    private readonly coupons: CouponsService,
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('auth/otp/start')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envía un código de un solo uso al teléfono (en la PoC, a la consola y a Mailpit)',
  })
  start(@Body() dto: OtpStartDto): Promise<OtpStartResponse> {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw invalidPhone();
    return this.otp.start(phone);
  }

  @Post('auth/otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Comprueba el código y crea la cuenta o inicia sesión (FR-USR-02)' })
  async verify(@Body() dto: OtpVerifyDto): Promise<UserSession> {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw invalidPhone();
    // Para crear una cuenta hay que aceptar los términos; se comprueba antes de gastar el código.
    const exists = await this.db.query.users.findFirst({
      where: eq(users.phoneHash, hashPii(phone, this.env.PII_ENCRYPTION_KEY)),
    });
    if (!exists && dto.consents?.terms !== true) {
      throw new AppError(
        'TERMS_REQUIRED',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Para crear tu cuenta debes aceptar las condiciones',
      );
    }
    await this.otp.verify(phone, dto.code);
    const { id, isNew } = await this.usersService.upsertByPhone(phone, dto.name);
    if (dto.consents) await this.usersService.recordConsents(id, dto.consents, 'signup');
    const expiresIn = this.env.JWT_USER_TTL_SECONDS;
    return {
      accessToken: await this.tokens.sign(id, expiresIn),
      expiresIn,
      user: await this.usersService.me(id),
      isNew,
    };
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil y consentimientos del comensal' })
  me(@CurrentUserId() userId: string): Promise<MeView> {
    return this.usersService.me(userId);
  }

  @Put('me/consents')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambia consentimientos: marketing o compartir datos con un comercio (FR-USR-04)',
  })
  async consents(@CurrentUserId() userId: string, @Body() dto: ConsentsDto): Promise<MeView> {
    if (dto.marketing !== undefined) await this.usersService.setMarketing(userId, dto.marketing);
    if (dto.merchantId && dto.shareWithMerchant !== undefined) {
      await this.usersService.setMerchantShare(userId, dto.merchantId, dto.shareWithMerchant);
    }
    return this.usersService.me(userId);
  }

  @Get('me/loyalty')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Puntos y recompensas por comercio' })
  loyaltyView(@CurrentUserId() userId: string): Promise<LoyaltyView[]> {
    return this.loyalty.view(userId);
  }

  @Get('me/coupons')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cupones disponibles (opcionalmente, de un comercio)' })
  myCoupons(
    @CurrentUserId() userId: string,
    @Query('merchantId') merchantId?: string,
  ): Promise<CouponView[]> {
    return this.coupons.listForUser(this.db, userId, merchantId || undefined);
  }

  @Post('me/rewards/:id/redeem')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Canjea puntos por una recompensa: emite un cupón de un solo uso (FR-LOY-03)',
  })
  redeem(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CouponView> {
    return this.loyalty.redeemReward(userId, id);
  }

  @Post('me/claim')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reclama los puntos de un pago hecho sin cuenta, en las 24 h siguientes (FR-USR-02)',
  })
  claim(@CurrentUserId() userId: string, @Body() dto: ClaimDto): Promise<ClaimPointsResponse> {
    return this.loyalty.claim(userId, dto.paymentId, dto.statusToken);
  }
}
