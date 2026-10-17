import { Inject, Injectable } from '@nestjs/common';
import { DB, type Database, type Tx } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';

export interface AuditEntry {
  actorType: 'MERCHANT_USER' | 'USER' | 'ADMIN' | 'SYSTEM';
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Escribe en el registro de auditoría (solo inserción). Acepta una transacción para ser atómico. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    await (tx ?? this.db).insert(auditLogs).values(entry);
  }
}
