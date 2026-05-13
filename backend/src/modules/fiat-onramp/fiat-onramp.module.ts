import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { LedgerModule } from "../ledger/ledger.module";
import { AdminFiatOnrampController } from "./admin-fiat-onramp.controller";
import { FiatOnrampController } from "./fiat-onramp.controller";
import { FiatOnrampService } from "./fiat-onramp.service";

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    MulterModule.register({}),
  ],
  providers: [FiatOnrampService],
  controllers: [FiatOnrampController, AdminFiatOnrampController],
  exports: [FiatOnrampService],
})
export class FiatOnrampModule {}
