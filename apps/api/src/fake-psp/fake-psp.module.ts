import { Module } from '@nestjs/common';
import { FakePspController } from './fake-psp.controller.js';
import { FakePspService } from './fake-psp.service.js';

/** PSP simulado de la PoC (ARCHITECTURE §16.3). Hace de sistema externo; nunca en producción. */
@Module({
  controllers: [FakePspController],
  providers: [FakePspService],
  exports: [FakePspService],
})
export class FakePspModule {}
