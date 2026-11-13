import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { LocationInfo, TableInfo, TablePlace } from '@comercechat/contracts';
import { AppError, InternalAuthGuard } from '@comercechat/service-kit';
import { VenuesDirectory } from './venues-directory.js';

/** VenuesDirectory por HTTP para otros servicios (MIGRACION §3.3). */
@ApiExcludeController()
@UseGuards(InternalAuthGuard)
@Controller('internal/venues')
export class VenuesInternalController {
  constructor(private readonly venues: VenuesDirectory) {}

  @Get('merchants/:merchantId/locations')
  locationsOf(@Param('merchantId', new ParseUUIDPipe()) id: string): Promise<LocationInfo[]> {
    return this.venues.locationsOf(id);
  }

  @Get('locations/:locationId')
  async location(@Param('locationId', new ParseUUIDPipe()) id: string): Promise<LocationInfo> {
    const l = await this.venues.location(id);
    if (!l) throw new AppError('LOCATION_NOT_FOUND', HttpStatus.NOT_FOUND, 'Local no encontrado');
    return l;
  }

  @Get('locations/:locationId/tables')
  tablesOf(@Param('locationId', new ParseUUIDPipe()) id: string): Promise<TableInfo[]> {
    return this.venues.tablesOf(id);
  }

  @Get('tables/:tableId/place')
  async tablePlace(@Param('tableId', new ParseUUIDPipe()) id: string): Promise<TablePlace> {
    const p = await this.venues.tablePlace(id);
    if (!p) throw new AppError('TABLE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Mesa no encontrada');
    return p;
  }
}
