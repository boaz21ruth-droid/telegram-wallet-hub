import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { StakingService } from "./staking.service";
import { StakingYieldScheduler } from "./staking-yield.scheduler";
import { StakingController } from "./staking.controller";
import { AdminStakingController } from "./admin-staking.controller";

@Module({
  imports: [LedgerModule],
  providers: [StakingService, StakingYieldScheduler],
  controllers: [StakingController, AdminStakingController],
  exports: [StakingService],
})
export class StakingModule {}
