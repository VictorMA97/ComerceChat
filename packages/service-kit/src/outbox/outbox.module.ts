import { Global, Module } from '@nestjs/common';
import { AuditEmitter } from './audit-emitter.js';
import { OutboxRelayService } from './outbox-relay.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  providers: [OutboxService, OutboxRelayService, AuditEmitter],
  exports: [OutboxService, OutboxRelayService, AuditEmitter],
})
export class OutboxModule {}
