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
import { UsersModule } from "./modules/users/users.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { WithdrawalsModule } from "./modules/withdrawals/withdrawals.module";
import { TonModule } from "./modules/ton/ton.module";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: env().JWT_SECRET,
      signOptions: {
        expiresIn: env().JWT_EXPIRES_IN,
      },
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    WalletModule,
    LedgerModule,
    DepositsModule,
    TransfersModule,
    WithdrawalsModule,
    ScheduleModule.forRoot(),
    TonModule,
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
