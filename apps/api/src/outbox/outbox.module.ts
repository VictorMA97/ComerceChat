import { Global, Module } from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService, OutboxRelayService],
})
export class OutboxModule {}
