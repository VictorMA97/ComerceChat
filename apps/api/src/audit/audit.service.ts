import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { OutboxRelayService } from '@comercechat/service-kit';
import { auditLogs } from './schema/audit.js';

export type AuditRow = typeof auditLogs.$inferSelect;

/**
 * Registro de auditoría de solo inserción (ADR-028): la base de datos rechaza UPDATE y DELETE. Las
 * entradas llegan de todos los contextos por `AuditRecorded.v1` (ADR-029); se insertan con su id,
 * así que un evento repetido no duplica nada.
 */
@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly relay: OutboxRelayService,
  ) {}

  onModuleInit(): void {
    this.relay.on('audit', 'AuditRecorded.v1', async ({ payload: { entryId, at, ...entry } }) => {
      await this.db
        .insert(auditLogs)
        .values({ ...entry, id: entryId, createdAt: new Date(at) })
        .onConflictDoNothing({ target: auditLogs.id });
    });
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
