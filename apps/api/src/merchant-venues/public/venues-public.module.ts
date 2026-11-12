import { Global, Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module.js';
import { VenuesDirectory } from './venues-directory.js';

/** Expone `VenuesDirectory` a toda la aplicación sin que los contextos importen módulos internos. */
@Global()
@Module({ imports: [QrModule], providers: [VenuesDirectory], exports: [VenuesDirectory] })
export class VenuesPublicModule {}
