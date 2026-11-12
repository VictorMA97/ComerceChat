import { Inject, Injectable } from '@nestjs/common';
import type { AuditRecordedV1 } from '@comercechat/contracts';
import { newId } from '../common/ids.js';
import { DB, type Database, type Tx } from '../db/client.js';
import { OutboxService } from './outbox.service.js';

export type AuditEntry = Omit<AuditRecordedV1, 'entryId' | 'at'>;

/**
 * Registro de auditoría desde cualquier contexto (ADR-028, ADR-029). Escribe `AuditRecorded.v1` en
 * el outbox: con `tx`, en la misma transacción que el cambio que registra, así que la entrada nunca
 * se pierde; audit la inserta después en `audit_logs`. El id (UUIDv7) se fija aquí, en el momento
 * de la acción: ordena el registro de actividad y hace idempotente la inserción.
 */
@Injectable()
export class AuditEmitter {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly outbox: OutboxService,
  ) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const entryId = newId();
    await this.outbox.enqueue(tx ?? this.db, {
      aggregate: entry.entity,
      aggregateId: entry.entityId ?? entryId,
      type: 'AuditRecorded.v1',
      payload: { ...entry, entryId, at: new Date().toISOString() },
    });
  }
}
