import { Module } from '@nestjs/common';
import { MerchantAuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

/** Registro de auditoría y de actividad del comercio (ADR-028). Se escribe con `AuditEmitter`. */
@Module({ controllers: [MerchantAuditController], providers: [AuditService] })
export class AuditModule {}
