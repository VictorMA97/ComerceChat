import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { AuditEntryView, AuditPage } from '@comercechat/shared-types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard, MerchantRoles } from '../auth/merchant-auth.guard.js';
import { DB, type Database } from '../db/client.js';
import { merchantUsers } from '../db/schema/index.js';

class AuditQueryDto {
  @ApiProperty({ required: false, description: 'Cursor: id de la última entrada recibida' })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiProperty({ required: false, default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Recorta la IP: IPv4 sin el último octeto, IPv6 con los tres primeros grupos. */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, '');
  if (ip === '::1' || v4.startsWith('127.')) return 'local';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return `${v4.split('.').slice(0, 3).join('.')}.x`;
  return `${ip.split(':').slice(0, 3).join(':')}:…`;
}

@ApiTags('merchant')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/audit')
export class MerchantAuditController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @MerchantRoles('OWNER')
  @ApiOperation({
    summary: 'Registro de actividad del comercio: accesos, doble factor, QR, locales, promociones',
  })
  async list(
    @CurrentMerchant() p: MerchantPrincipal,
    @Query() q: AuditQueryDto,
  ): Promise<AuditPage> {
    const limit = q.limit ?? 50;
    // Uno de más para saber si hay página siguiente.
    const rows = await this.audit.listForMerchant(p.merchantId, limit + 1, q.before);
    const page = rows.slice(0, limit);
    const actorIds = [
      ...new Set(
        page.filter((r) => r.actorType === 'MERCHANT_USER' && r.actorId).map((r) => r.actorId!),
      ),
    ];
    const users = actorIds.length
      ? await this.db
          .select({ id: merchantUsers.id, email: merchantUsers.email })
          .from(merchantUsers)
          .where(inArray(merchantUsers.id, actorIds))
      : [];
    const emails = new Map(users.map((u) => [u.id, u.email]));
    const items: AuditEntryView[] = page.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      action: r.action,
      actor: {
        type: r.actorType as AuditEntryView['actor']['type'],
        email: r.actorId ? (emails.get(r.actorId) ?? null) : null,
      },
      entity: r.entity,
      entityId: r.entityId,
      ip: maskIp(r.ip),
    }));
    return { items, nextCursor: rows.length > limit ? page[page.length - 1]!.id : null };
  }
}
