import { Module } from "@nestjs/common";
import { DepositsModule } from "../deposits/deposits.module";
import { DepositScannerService } from "./deposit-scanner.service";
import { TonService } from "./ton.service";

@Module({
  imports: [DepositsModule],
  providers: [TonService, DepositScannerService],
  exports: [TonService],
})
export class TonModule {}
