import { Module } from '@nestjs/common';
import { DynamicQrModule } from '../table-payments/dynamic-qr/dynamic-qr.module.js';
import { FakePosConnector } from './fake-pos.connector.js';
import { FakePosController } from './fake-pos.controller.js';

/** Software de caja simulado y su página del panel (ARCHITECTURE §16.3). Nunca en producción. */
@Module({
  imports: [DynamicQrModule],
  controllers: [FakePosController],
  providers: [FakePosConnector],
  exports: [FakePosConnector],
})
export class FakePosModule {}
