import { Global, Module } from '@nestjs/common';
import { LoyaltyDirectory } from './loyalty-directory.js';

/** Expone `LoyaltyDirectory` a toda la aplicación sin que los contextos importen módulos internos. */
@Global()
@Module({ providers: [LoyaltyDirectory], exports: [LoyaltyDirectory] })
export class LoyaltyPublicModule {}
