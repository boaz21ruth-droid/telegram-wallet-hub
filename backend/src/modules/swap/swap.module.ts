import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { LedgerModule } from "../ledger/ledger.module";
import { AdminSwapController } from "./admin-swap.controller";
import { PriceService } from "./price.service";
import { SwapController } from "./swap.controller";
import { SwapService } from "./swap.service";

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [PriceService, SwapService],
  controllers: [SwapController, AdminSwapController],
  exports: [PriceService, SwapService],
})
export class SwapModule {}
