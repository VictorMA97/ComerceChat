import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module.js';
import { FloorService } from './floor.service.js';
import { FloorController, TableBillController } from './tables.controller.js';
import { TableBillService } from './table-bill.service.js';

@Module({
  imports: [QrModule],
  controllers: [TableBillController, FloorController],
  providers: [TableBillService, FloorService],
  exports: [TableBillService],
})
export class TablesModule {}
