import { Global, Module } from '@nestjs/common';
import { FakePosHttpConnector, POS_CONNECTOR } from '@comercechat/pos-connectors';
import { InternalHttpClient } from '@comercechat/service-kit';
import { ENV, type Env } from '../config/env.js';

/** Elige el adaptador del software de caja (ARCHITECTURE §6.2). Raíz de composición. */
@Global()
@Module({
  providers: [
    {
      provide: POS_CONNECTOR,
      inject: [ENV],
      useFactory: (env: Env) => {
        // El simulador es un servicio aparte desde MS F3 (services/fake-pos): se le llama por HTTP.
        if (env.POS_CONNECTOR === 'fake') {
          return new FakePosHttpConnector(
            new InternalHttpClient('fake-pos', env.FAKE_POS_URL, env.INTERNAL_SERVICE_SECRET),
          );
        }
        // ManualPosConnector (FR-ORD-05) y los adaptadores reales llegan con D-02.
        throw new Error(`POS_CONNECTOR=${env.POS_CONNECTOR} aún no está implementado`);
      },
    },
  ],
  exports: [POS_CONNECTOR],
})
export class PosModule {}
