import { Module } from "@nestjs/common";

import { AdminGuard } from "../../common/guards/admin.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { AdminWithdrawalsController } from "./admin-withdrawals.controller";
import { WithdrawalsController } from "./withdrawals.controller";
import { WithdrawalsService } from "./withdrawals.service";

@Module({
  imports: [LedgerModule],
  controllers: [WithdrawalsController, AdminWithdrawalsController],
  providers: [WithdrawalsService, AdminGuard],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
