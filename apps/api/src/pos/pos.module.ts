import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { FakePosConnector } from '../fake-pos/fake-pos.connector.js';
import { FakePosModule } from '../fake-pos/fake-pos.module.js';
import { POS_CONNECTOR } from '@comercechat/pos-connectors';

/** Elige el adaptador del software de caja (ARCHITECTURE §6.2). Raíz de composición. */
@Global()
@Module({
  imports: [FakePosModule],
  providers: [
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
