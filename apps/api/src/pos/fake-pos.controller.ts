import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { FakePosState } from '@comercechat/shared-types';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { and, asc, desc, eq, gt, inArray, or } from 'drizzle-orm';
import type { MerchantPrincipal } from '../auth/auth.types.js';
import { CurrentMerchant, MerchantAuthGuard } from '../auth/merchant-auth.guard.js';
import { AppError } from '../common/app-error.js';
import { ENV, type Env } from '../config/env.js';
import { DynamicQrService } from '../qr/dynamic-qr.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { DB, type Database } from '../db/client.js';
import {
  fakePosBillItems,
  fakePosBills,
  fakePosLocations,
  fakePosMenuItems,
  fakePosPayments,
  merchantLocations,
  tables,
} from '../db/schema/index.js';

/** El simulador sigue mostrando una cuenta cerrada durante 30 min, para ver el pago que la cerró. */
const RECENT_CLOSED_MS = 30 * 60 * 1000;

class AddItemDto {
  @ApiProperty() @IsUUID() menuItemId: string;
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  qty?: number;
}

class HealthDto {
  @ApiProperty() @IsBoolean() healthy: boolean;
}

/**
 * API del simulador de caja (ARCHITECTURE §16.3). Hace de "pantalla del TPV": abrir cuentas,
 * añadir platos, ver los pagos que registra ComerceChat y simular caídas. Solo con POS_CONNECTOR=fake.
 */
@ApiTags('fake-pos (simulador)')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/fake-pos')
export class FakePosController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly realtime: RealtimeService,
    private readonly dynamicQr: DynamicQrService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado del TPV simulado de cada local del comercio' })
  async state(@CurrentMerchant() p: MerchantPrincipal): Promise<FakePosState[]> {
    this.assertEnabled();
    const locations = await this.db
      .select()
      .from(merchantLocations)
      .where(eq(merchantLocations.merchantId, p.merchantId))
      .orderBy(asc(merchantLocations.name));
    return Promise.all(locations.map((l) => this.locationState(l.id, l.name)));
  }

  @Post('tables/:tableId/items')
  @ApiOperation({ summary: 'Añade un plato a la cuenta de la mesa (la abre si no existe)' })
  async addItem(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
    @Body() dto: AddItemDto,
  ): Promise<void> {
    this.assertEnabled();
    const table = await this.ownTable(p, tableId);
    const item = await this.db.query.fakePosMenuItems.findFirst({
      where: and(
        eq(fakePosMenuItems.id, dto.menuItemId),
        eq(fakePosMenuItems.locationId, table.locationId),
      ),
    });
    if (!item)
      throw new AppError('MENU_ITEM_NOT_FOUND', HttpStatus.NOT_FOUND, 'Plato no encontrado');
    await this.db.transaction(async (tx) => {
      let bill = await tx.query.fakePosBills.findFirst({
        where: and(
          eq(fakePosBills.locationId, table.locationId),
          eq(fakePosBills.externalTableId, table.externalTableId),
          eq(fakePosBills.status, 'OPEN'),
        ),
      });
      if (!bill) {
        [bill] = await tx
          .insert(fakePosBills)
          .values({ locationId: table.locationId, externalTableId: table.externalTableId })
          .returning();
      }
      await tx.insert(fakePosBillItems).values({
        billId: bill!.id,
        name: item.name,
        qty: dto.qty ?? 1,
        unitPriceCents: item.priceCents,
      });
    });
    await this.realtime.publishTable(table.locationId, tableId, 'pos.item_added');
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quita una línea de la cuenta' })
  async removeItem(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<void> {
    this.assertEnabled();
    const [row] = await this.db
      .select({ id: fakePosBillItems.id, locationId: fakePosBills.locationId })
      .from(fakePosBillItems)
      .innerJoin(fakePosBills, eq(fakePosBills.id, fakePosBillItems.billId))
      .where(and(eq(fakePosBillItems.id, itemId), eq(fakePosBills.status, 'OPEN')));
    if (!row || !(await this.ownsLocation(p, row.locationId))) {
      throw new AppError('BILL_ITEM_NOT_FOUND', HttpStatus.NOT_FOUND, 'Línea no encontrada');
    }
    await this.db.delete(fakePosBillItems).where(eq(fakePosBillItems.id, itemId));
    // Sin mesa concreta: avisa a todo el local.
    await this.realtime.publishTable(row.locationId, null, 'pos.item_removed');
  }

  @Post('tables/:tableId/close')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Cierra la cuenta de la mesa (como si se cobrara fuera de ComerceChat)',
  })
  async closeBill(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
  ): Promise<void> {
    this.assertEnabled();
    const table = await this.ownTable(p, tableId);
    await this.db
      .update(fakePosBills)
      .set({ status: 'CLOSED', closedAt: new Date() })
      .where(
        and(
          eq(fakePosBills.locationId, table.locationId),
          eq(fakePosBills.externalTableId, table.externalTableId),
          eq(fakePosBills.status, 'OPEN'),
        ),
      );
    await this.realtime.publishTable(table.locationId, tableId, 'pos.bill_closed');
  }

  @Post('locations/:locationId/health')
  @HttpCode(204)
  @ApiOperation({ summary: 'Simula que el TPV se cae o se recupera (FR-POS-06)' })
  async setHealth(
    @CurrentMerchant() p: MerchantPrincipal,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body() dto: HealthDto,
  ): Promise<void> {
    this.assertEnabled();
    if (!(await this.ownsLocation(p, locationId))) {
      throw new AppError('LOCATION_NOT_FOUND', HttpStatus.NOT_FOUND, 'Local no encontrado');
    }
    await this.db
      .insert(fakePosLocations)
      .values({ locationId, healthy: dto.healthy })
      .onConflictDoUpdate({ target: fakePosLocations.locationId, set: { healthy: dto.healthy } });
    await this.realtime.publishTable(locationId, null, dto.healthy ? 'pos.up' : 'pos.down');
  }

  private assertEnabled(): void {
    if (this.env.POS_CONNECTOR !== 'fake') {
      throw new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, 'Simulador de caja desactivado');
    }
  }

  private async ownsLocation(p: MerchantPrincipal, locationId: string): Promise<boolean> {
    const loc = await this.db.query.merchantLocations.findFirst({
      where: and(
        eq(merchantLocations.id, locationId),
        eq(merchantLocations.merchantId, p.merchantId),
      ),
    });
    return Boolean(loc);
  }

  private async ownTable(p: MerchantPrincipal, tableId: string) {
    const [table] = await this.db
      .select({
        id: tables.id,
        locationId: tables.locationId,
        externalTableId: tables.externalTableId,
      })
      .from(tables)
      .innerJoin(merchantLocations, eq(merchantLocations.id, tables.locationId))
      .where(and(eq(tables.id, tableId), eq(merchantLocations.merchantId, p.merchantId)));
    if (!table) throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');
    if (!table.externalTableId) {
      throw new AppError(
        'TABLE_NOT_LINKED',
        HttpStatus.CONFLICT,
        'La mesa no está enlazada con la caja',
      );
    }
    return { ...table, externalTableId: table.externalTableId };
  }

  private async locationState(locationId: string, locationName: string): Promise<FakePosState> {
    const [health, menu, tableRows, bills] = await Promise.all([
      this.db.query.fakePosLocations.findFirst({
        where: eq(fakePosLocations.locationId, locationId),
      }),
      this.db
        .select()
        .from(fakePosMenuItems)
        .where(eq(fakePosMenuItems.locationId, locationId))
        .orderBy(asc(fakePosMenuItems.category), asc(fakePosMenuItems.name)),
      this.db.select().from(tables).where(eq(tables.locationId, locationId)),
      this.db
        .select()
        .from(fakePosBills)
        .where(
          and(
            eq(fakePosBills.locationId, locationId),
            or(
              eq(fakePosBills.status, 'OPEN'),
              gt(fakePosBills.closedAt, new Date(Date.now() - RECENT_CLOSED_MS)),
            ),
          ),
        )
        .orderBy(desc(fakePosBills.openedAt)),
    ]);
    const paymentQrs = await this.dynamicQr.latestForTables(tableRows.map((t) => t.id));
    const billIds = bills.map((b) => b.id);
    const [items, pays] = billIds.length
      ? await Promise.all([
          this.db
            .select()
            .from(fakePosBillItems)
            .where(inArray(fakePosBillItems.billId, billIds))
            .orderBy(asc(fakePosBillItems.createdAt)),
          this.db
            .select()
            .from(fakePosPayments)
            .where(inArray(fakePosPayments.billId, billIds))
            .orderBy(asc(fakePosPayments.createdAt)),
        ])
      : [[], []];

    return {
      locationId,
      locationName,
      health: health?.healthy === false ? 'down' : 'ok',
      menu: menu.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        priceCents: m.priceCents,
      })),
      tables: tableRows
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))
        .map((t) => {
          const tableBills = bills.filter((b) => b.externalTableId === t.externalTableId);
          const bill = tableBills.find((b) => b.status === 'OPEN') ?? tableBills[0];
          const billItems = bill ? items.filter((i) => i.billId === bill.id) : [];
          const billPays = bill ? pays.filter((x) => x.billId === bill.id) : [];
          return {
            tableId: t.id,
            tableLabel: t.label,
            externalTableId: t.externalTableId,
            paymentQr: paymentQrs.get(t.id) ?? null,
            bill: bill
              ? {
                  id: bill.id,
                  status: bill.status,
                  closedAt: bill.closedAt?.toISOString() ?? null,
                  items: billItems.map((i) => ({
                    id: i.id,
                    name: i.name,
                    qty: i.qty,
                    unitPriceCents: i.unitPriceCents,
                  })),
                  payments: billPays.map((x) => ({
                    reference: x.reference,
                    amountCents: x.amountCents,
                    tipCents: x.tipCents,
                    discountCents: x.discountCents,
                    createdAt: x.createdAt.toISOString(),
                  })),
                  totalCents: billItems.reduce((s, i) => s + i.qty * i.unitPriceCents, 0),
                  paidCents: billPays.reduce((s, x) => s + x.amountCents, 0),
                }
              : null,
          };
        }),
    };
  }
}
