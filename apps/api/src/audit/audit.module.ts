import { Global, Module } from '@nestjs/common';
import { MerchantAuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Global()
@Module({
  controllers: [MerchantAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
