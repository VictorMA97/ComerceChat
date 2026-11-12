import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service.js';

/** Idempotency-Key compartida por los POST que crean pagos, reembolsos, canjes o campañas (ADR-015). */
@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
