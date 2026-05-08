import { Module } from "@nestjs/common";
import { DepositsModule } from "../deposits/deposits.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { Trc20DepositScannerService } from "./trc20-deposit-scanner.service";
import { Trc20HotWalletService } from "./trc20-hot-wallet.service";
import { Trc20Service } from "./trc20.service";
import { Trc20WithdrawalBroadcasterService } from "./trc20-withdrawal-broadcaster.service";

@Module({
  imports: [DepositsModule, WithdrawalsModule],
  providers: [
    Trc20Service,
    Trc20HotWalletService,
    Trc20DepositScannerService,
    Trc20WithdrawalBroadcasterService,
  ],
  exports: [Trc20Service, Trc20HotWalletService],
})
export class Trc20Module {}
