import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { ConsoleOtpSender, OTP_SENDER } from './otp-sender.js';
import { OtpService } from './otp.service.js';
import { USER_SESSION_VERIFIER } from '@comercechat/auth-client';
import { UserTokens } from './user-auth.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    OtpService,
    UserTokens,
    // Los guards de @comercechat/auth-client validan las sesiones del comensal con UserTokens.
    { provide: USER_SESSION_VERIFIER, useExisting: UserTokens },
    ConsoleOtpSender,
    {
      provide: OTP_SENDER,
      inject: [ENV, ConsoleOtpSender],
      // OTP_SENDER=console es el único valor en la PoC (D-04).
      useFactory: (_env: Env, sender: ConsoleOtpSender) => sender,
    },
  ],
  exports: [UserTokens, USER_SESSION_VERIFIER],
})
export class UsersModule {}
