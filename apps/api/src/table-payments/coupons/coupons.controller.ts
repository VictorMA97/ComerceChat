import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CouponView } from '@comercechat/shared-types';
import { isUUID } from 'class-validator';
import { AppError } from '../../common/app-error.js';
import { CurrentUserId, UserAuthGuard } from '../../identity/public/session.js';
import { CouponsService } from './coupons.service.js';

/** Cupones del comensal que puede usar al pagar (FR-CPN-04). */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('me')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get('coupons')
  @ApiOperation({ summary: 'Cupones disponibles (opcionalmente, de un comercio)' })
  myCoupons(
    @CurrentUserId() userId: string,
    @Query('merchantId') merchantId?: string,
  ): Promise<CouponView[]> {
    // Vacío = todos los comercios. Si viene, tiene que ser un UUID (si no, Postgres fallaría con un 500).
    if (merchantId && !isUUID(merchantId)) {
      throw new AppError('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, 'merchantId no es válido');
    }
    return this.coupons.listForUser(userId, merchantId || undefined);
  }
}
