import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

/** Estado de los cupones: reserva y canje atómicos en la transacción del pago (FR-CPN-06, ADR-029). */
@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
