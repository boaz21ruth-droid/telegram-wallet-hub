import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";

import { env } from "./config/env";
import { PrismaModule } from "./common/prisma/prisma.module";
import { PrismaService } from "./common/prisma/prisma.service";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminAuthModule } from "./modules/admin-auth/admin-auth.module";
import { UsersModule } from "./modules/users/users.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { WithdrawalsModule } from "./modules/withdrawals/withdrawals.module";
import { TonModule } from "./modules/ton/ton.module";
import { Trc20Module } from "./modules/trc20/trc20.module";
import { TelegramNotificationModule } from "./common/telegram/telegram-notification.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { SwapModule } from "./modules/swap/swap.module";
import { FiatOnrampModule } from "./modules/fiat-onramp/fiat-onramp.module";
import { StakingModule } from "./modules/staking/staking.module";

@Module({
  imports: [
    PrismaModule,
    TelegramNotificationModule,
    JwtModule.register({
      global: true,
      secret: env().JWT_SECRET,
      signOptions: {
        expiresIn: env().JWT_EXPIRES_IN,
      },
    }),
    HealthModule,
    AuthModule,
    AdminAuthModule,
    UsersModule,
    WalletModule,
    LedgerModule,
    DepositsModule,
    TransfersModule,
    WithdrawalsModule,
    ScheduleModule.forRoot(),
    TonModule,
    Trc20Module,
    KycModule,
    SwapModule,
    FiatOnrampModule,
    StakingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, jwtService: JwtService, prisma: PrismaService) =>
        new JwtAuthGuard(reflector, jwtService, prisma),
      inject: [Reflector, JwtService, PrismaService],
    },
  ],
})
export class AppModule {}
