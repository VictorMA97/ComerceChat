import { Module } from '@nestjs/common';
import { QrModule } from '../../merchant-venues/qr/qr.module.js';
import { DynamicQrModule } from '../dynamic-qr/dynamic-qr.module.js';
import { FloorService } from './floor.service.js';
import { FloorController, TableBillController } from './tables.controller.js';
import { TableBillService } from './table-bill.service.js';

@Module({
  imports: [QrModule, DynamicQrModule],
  controllers: [TableBillController, FloorController],
  providers: [TableBillService, FloorService],
  exports: [TableBillService],
})
export class TablesModule {}
