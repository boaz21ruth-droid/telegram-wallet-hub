import { Module } from "@nestjs/common";

import { AdminGuard } from "../../common/guards/admin.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { DepositsModule } from "../deposits/deposits.module";
import { TonModule } from "../ton/ton.module";
import { Trc20Module } from "../trc20/trc20.module";
import { AdminWalletController } from "./admin-wallet.controller";
import { WalletAdminService } from "./wallet-admin.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [DepositsModule, LedgerModule, TonModule, Trc20Module],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService, WalletAdminService, AdminGuard],
  exports: [WalletService],
})
export class WalletModule {}
