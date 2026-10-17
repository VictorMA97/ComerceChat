import { Controller, Get, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MerchantMe } from '@comercechat/shared-types';
import { eq } from 'drizzle-orm';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard } from '../auth/merchant-auth.guard.js';
import { AppError } from '../common/app-error.js';
import { DB, type Database } from '../db/client.js';
import { merchantUsers } from '../db/schema/index.js';

@ApiTags('merchant')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant')
export class MerchantsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('me')
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
      merchant: {
        id: user.merchant.id,
        brandName: user.merchant.brandName,
        status: user.merchant.status,
      },
    };
  }
}
