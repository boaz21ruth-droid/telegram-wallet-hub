import { Module } from "@nestjs/common";

import { LedgerModule } from "../ledger/ledger.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [LedgerModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
