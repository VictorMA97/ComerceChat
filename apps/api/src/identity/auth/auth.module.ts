import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type Env } from '../../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MERCHANT_AUTH_PROVIDER } from './auth.types.js';
import { LocalMerchantAuthProvider } from './local-merchant-auth.provider.js';
import { MerchantAuthGuard } from './merchant-auth.guard.js';
import { IdentityDirectory } from '../public/identity-directory.js';
import { MerchantMfaService } from './merchant-mfa.service.js';
import { TokenRevocationService } from './token-revocation.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { algorithm: 'HS256' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    IdentityDirectory,
    MerchantMfaService,
    MerchantAuthGuard,
    TokenRevocationService,
    // AUTH_PROVIDER=local es el único valor en la PoC (D-03).
    { provide: MERCHANT_AUTH_PROVIDER, useClass: LocalMerchantAuthProvider },
  ],
  exports: [
    AuthService,
    IdentityDirectory,
    MerchantMfaService,
    MerchantAuthGuard,
    TokenRevocationService,
    JwtModule,
  ],
})
export class AuthModule {}
