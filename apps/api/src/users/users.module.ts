import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { ConsoleOtpSender, OTP_SENDER } from './otp-sender.js';
import { OtpService } from './otp.service.js';
import { OptionalUserGuard, UserAuthGuard, UserTokens } from './user-auth.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [LoyaltyModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    OtpService,
    UserTokens,
    UserAuthGuard,
    OptionalUserGuard,
    ConsoleOtpSender,
    {
      provide: OTP_SENDER,
      inject: [ENV, ConsoleOtpSender],
      // OTP_SENDER=console es el único valor en la PoC (D-04).
      useFactory: (_env: Env, sender: ConsoleOtpSender) => sender,
    },
  ],
  exports: [UserTokens, UserAuthGuard, OptionalUserGuard],
})
export class UsersModule {}
