import { Module } from "@nestjs/common";

import { AdminGuard } from "../../common/guards/admin.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { AdminDepositsController } from "./admin-deposits.controller";
import { DepositsController } from "./deposits.controller";
import { DepositsService } from "./deposits.service";

@Module({
  imports: [LedgerModule],
  controllers: [DepositsController, AdminDepositsController],
  providers: [DepositsService, AdminGuard],
  exports: [DepositsService],
})
export class DepositsModule {}
