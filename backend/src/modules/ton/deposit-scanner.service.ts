import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DepositsService } from "../deposits/deposits.service";
import { TonService } from "./ton.service";

@Injectable()
export class DepositScannerService {
  private readonly logger = new Logger(DepositScannerService.name);
  private scanning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tonService: TonService,
    private readonly depositsService: DepositsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scan() {
    if (this.scanning) return; // prevent overlapping runs
    this.scanning = true;
    try {
      await this.runScan();
    } catch (err) {
      this.logger.error(`Scan cycle failed: ${err}`);
    } finally {
      this.scanning = false;
    }
  }

  private async runScan() {
    const addresses = await this.prisma.walletAddress.findMany({
      where: { isPrimary: true },
      include: { walletAccount: true },
    });

    for (const addr of addresses) {
      try {
        // For USDT accounts, resolve the Jetton wallet address for fraud prevention
        let expectedUsdtJettonWallet: string | null = null;
        if (addr.walletAccount.assetCode === "USDT") {
          expectedUsdtJettonWallet = await this.tonService.getUsdtJettonWalletAddress(
            addr.address,
          );
        }

        const deposits = await this.tonService.getNewDeposits(
          addr.address,
          addr.lastScannedLt,
          expectedUsdtJettonWallet,
        );

        // Only process deposits whose asset matches this wallet account
        const relevant = deposits.filter(
          (d) => d.assetCode === addr.walletAccount.assetCode,
        );

        let maxLt = BigInt(addr.lastScannedLt);

        for (const deposit of relevant) {
          try {
            await this.depositsService.creditDepositBySystem({
              walletAccountId: addr.walletAccount.id,
              assetCode: deposit.assetCode,
              network: addr.walletAccount.network,
              amount: deposit.amount,
              fromAddress: deposit.fromAddress ?? undefined,
              txHash: deposit.txHash,
            });
            this.logger.log(
              `Credited ${deposit.amount} ${deposit.assetCode} to walletAccount=${addr.walletAccount.id} txHash=${deposit.txHash}`,
            );
          } catch (err: unknown) {
            this.logger.error(
              `Failed to credit txHash=${deposit.txHash}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }

        // Advance cursor to the highest LT seen in this batch
        if (deposits.length > 0) {
          const highestLt = BigInt(deposits[0].lt); // array is newest-first
          if (highestLt > maxLt) maxLt = highestLt;
        }

        if (maxLt > BigInt(addr.lastScannedLt)) {
          await this.prisma.walletAddress.update({
            where: { id: addr.id },
            data: { lastScannedLt: maxLt.toString() },
          });
        }
      } catch (err) {
        this.logger.error(`Scan failed for address ${addr.address}: ${err}`);
      }
    }
  }
}
