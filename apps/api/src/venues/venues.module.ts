import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  imports: [QrModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
