import { Global, Module } from '@nestjs/common';
import { MerchantEventsController, TableEventsController } from './realtime.controller.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  controllers: [TableEventsController, MerchantEventsController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
