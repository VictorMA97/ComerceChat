import { Module } from '@nestjs/common';
import { FakePosConnector } from './fake-pos.connector.js';
import { FakePosController } from './fake-pos.controller.js';

/** Software de caja simulado y su página del panel (ARCHITECTURE §16.3). Nunca en producción. */
@Module({
  controllers: [FakePosController],
  providers: [FakePosConnector],
  exports: [FakePosConnector],
})
export class FakePosModule {}
