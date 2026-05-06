import { Module } from "@nestjs/common";
import { DepositsModule } from "../deposits/deposits.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { DepositScannerService } from "./deposit-scanner.service";
import { HotWalletService } from "./hot-wallet.service";
import { TonService } from "./ton.service";
import { WithdrawalBroadcasterService } from "./withdrawal-broadcaster.service";

@Module({
  imports: [DepositsModule, WithdrawalsModule],
  providers: [TonService, DepositScannerService, HotWalletService, WithdrawalBroadcasterService],
  exports: [TonService, HotWalletService],
})
export class TonModule {}
