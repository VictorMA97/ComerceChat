import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { QrModule } from '../qr/qr.module.js';
import { FakePosConnector } from './fake-pos.connector.js';
import { FakePosController } from './fake-pos.controller.js';
import { POS_CONNECTOR } from './pos-connector.js';

@Global()
@Module({
  imports: [QrModule],
  controllers: [FakePosController],
  providers: [
    FakePosConnector,
    {
      provide: POS_CONNECTOR,
      inject: [ENV, FakePosConnector],
      useFactory: (env: Env, fake: FakePosConnector) => {
        if (env.POS_CONNECTOR === 'fake') return fake;
        // ManualPosConnector (FR-ORD-05) y los adaptadores reales llegan con D-02.
        throw new Error(`POS_CONNECTOR=${env.POS_CONNECTOR} aún no está implementado`);
      },
    },
  ],
  exports: [POS_CONNECTOR],
})
export class PosModule {}
