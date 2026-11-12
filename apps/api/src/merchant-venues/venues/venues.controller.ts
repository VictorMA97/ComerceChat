import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { LocationView } from '@comercechat/shared-types';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { MerchantPrincipal } from '../../identity/public/session.js';
import {
  CurrentMerchant,
  MerchantAuthGuard,
  MerchantRoles,
} from '../../identity/public/session.js';
import { ClientIp } from '@comercechat/service-kit';
import { VenuesService } from './venues.service.js';

const CATEGORIES = ['restaurant', 'bar', 'cafe'] as const;

class AddTablesDto {
  @ApiProperty({ minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  count: number;

  @ApiProperty({ required: false, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;
}

class CreateLocationDto {
  @ApiProperty({ example: 'Casa Pepe Lavapiés' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'Calle de Argumosa 1, 28012 Madrid' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @ApiProperty({ example: 40.4087 }) @IsLatitude() lat: number;
  @ApiProperty({ example: -3.6996 }) @IsLongitude() lng: number;

  @ApiProperty({ required: false, description: 'Mesas que se crean con el local (0–50)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  tableCount?: number;

  @ApiProperty({ required: false, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;
}

@ApiTags('merchant-venues')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('merchant/locations')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'Locales del comercio con sus mesas y QR activos' })
  list(@CurrentMerchant() principal: MerchantPrincipal): Promise<LocationView[]> {
    return this.venues.listLocations(principal.merchantId);
  }

  @Post()
  @MerchantRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Da de alta un local y, si se indica, sus primeras mesas (FR-MER-03)' })
  create(
    @CurrentMerchant() principal: MerchantPrincipal,
    @Body() dto: CreateLocationDto,
    @ClientIp() ip: string,
  ): Promise<{ id: string }> {
    return this.venues.createLocation(principal, dto, ip);
  }

  @Post(':locationId/tables')
  @HttpCode(204)
  @MerchantRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Alta masiva de mesas con su QR (FR-MER-04)' })
  addTables(
    @CurrentMerchant() principal: MerchantPrincipal,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body() dto: AddTablesDto,
    @ClientIp() ip: string,
  ): Promise<void> {
    return this.venues.addTables(principal, locationId, dto.count, dto.capacity, ip);
  }
}
