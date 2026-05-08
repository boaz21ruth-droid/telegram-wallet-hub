import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DepositsService } from "../deposits/deposits.service";
import { Trc20Service } from "./trc20.service";

@Injectable()
export class Trc20DepositScannerService {
  private readonly logger = new Logger(Trc20DepositScannerService.name);
  private scanning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trc20Service: Trc20Service,
    private readonly depositsService: DepositsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await this.runScan();
    } catch (err) {
      this.logger.error(`TRC20 scan cycle failed: ${err}`);
    } finally {
      this.scanning = false;
    }
  }

  private async runScan() {
    const addresses = await this.prisma.walletAddress.findMany({
      where: { isPrimary: true, walletAccount: { network: "TRC20" } },
      include: { walletAccount: true },
    });

    for (const addr of addresses) {
      try {
        const deposits = await this.trc20Service.getNewDeposits(addr.address, addr.lastScannedLt);

        let maxTs = BigInt(addr.lastScannedLt === "0" ? "0" : addr.lastScannedLt);

        for (const deposit of deposits) {
          try {
            await this.depositsService.creditDepositBySystem({
              walletAccountId: addr.walletAccount.id,
              assetCode: "USDT",
              network: "TRC20",
              amount: deposit.amount,
              fromAddress: deposit.fromAddress,
              txHash: deposit.txHash,
            });
            this.logger.log(
              `Credited ${deposit.amount} USDT (TRC20) to walletAccount=${addr.walletAccount.id} txHash=${deposit.txHash}`,
            );
            if (deposit.blockTimestampMs > maxTs) maxTs = deposit.blockTimestampMs;
          } catch (err: unknown) {
            this.logger.error(
              `Failed to credit TRC20 txHash=${deposit.txHash}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }

        if (maxTs > BigInt(addr.lastScannedLt === "0" ? "0" : addr.lastScannedLt)) {
          await this.prisma.walletAddress.update({
            where: { id: addr.id },
            data: { lastScannedLt: maxTs.toString() },
          });
        }
      } catch (err) {
        this.logger.error(`TRC20 scan failed for address ${addr.address}: ${err}`);
      }
    }
  }
}
