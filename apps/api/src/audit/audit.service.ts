import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
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
  /** Comercio afectado: la entrada aparece en su registro de actividad (GET /merchant/audit). */
  merchantId?: string;
}

export type AuditRow = typeof auditLogs.$inferSelect;

/**
 * Registro de auditoría de solo inserción (ADR-028): la base de datos rechaza UPDATE y DELETE.
 * Acepta una transacción para que la entrada sea atómica con el cambio que registra.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    await (tx ?? this.db).insert(auditLogs).values(entry);
  }

  /** Entradas de un comercio, de la más reciente a la más antigua. Cursor: id (UUIDv7, ordenable). */
  async listForMerchant(merchantId: string, limit: number, before?: string): Promise<AuditRow[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.merchantId, merchantId), before ? lt(auditLogs.id, before) : undefined),
      )
      .orderBy(desc(auditLogs.id))
      .limit(limit);
  }
}
