import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { env } from "../../config/env";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { HotWalletService } from "./hot-wallet.service";
import { TelegramNotificationService } from "../../common/telegram/telegram-notification.service";

@Injectable()
export class WithdrawalBroadcasterService {
  private readonly logger = new Logger(WithdrawalBroadcasterService.name);
  private broadcasting = false;
  private confirming = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotWallet: HotWalletService,
    private readonly withdrawalsService: WithdrawalsService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  /** Pick up READY_FOR_SIGNING orders and broadcast them on-chain. */
  @Cron(CronExpression.EVERY_MINUTE)
  async broadcastPending() {
    if (!this.hotWallet.isEnabled || this.broadcasting) return;
    this.broadcasting = true;
    try {
      await this.runBroadcast();
    } catch (err) {
      this.logger.error(`Broadcast cycle failed: ${err}`);
    } finally {
      this.broadcasting = false;
    }
  }

  /** Check SIGNED orders and mark them CONFIRMED when found on-chain. */
  @Cron("0 */5 * * * *") // every 5 minutes
  async confirmSigned() {
    if (!this.hotWallet.isEnabled || this.confirming) return;
    this.confirming = true;
    try {
      await this.runConfirmation();
    } catch (err) {
      this.logger.error(`Confirmation cycle failed: ${err}`);
    } finally {
      this.confirming = false;
    }
  }

  private async runBroadcast() {
    const orders = await this.prisma.withdrawOrder.findMany({
      where: { status: "READY_FOR_SIGNING", network: "TON" },
      orderBy: { createdAt: "asc" },
      take: 5, // process at most 5 per minute to avoid seqno conflicts
    });

    for (const order of orders) {
      try {
        this.logger.log(
          `Broadcasting withdrawal ${order.id}: ${order.amount} ${order.assetCode} → ${order.toAddress}`,
        );

        let txHash: string;
        if (order.assetCode === "TON") {
          txHash = await this.hotWallet.broadcastTonTransfer(
            order.toAddress,
            order.amount.toString(),
          );
        } else if (order.assetCode === "USDT") {
          txHash = await this.hotWallet.broadcastUsdtTransfer(
            order.toAddress,
            order.amount.toString(),
          );
        } else {
          throw new Error(`Unsupported assetCode for on-chain withdrawal: ${order.assetCode}`);
        }

        await this.withdrawalsService.signWithdrawalBySystem(order.id, txHash);
        this.logger.log(`Withdrawal ${order.id} signed — txHash=${txHash}`);
      } catch (err) {
        this.logger.error(
          `Failed to broadcast withdrawal ${order.id}: ${err instanceof Error ? err.message : err}`,
        );
        // Continue to next order; this one will be retried next minute
      }
    }
  }

  private async runConfirmation() {
    const orders = await this.prisma.withdrawOrder.findMany({
      where: { status: "SIGNED", network: "TON" },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });

    for (const order of orders) {
      if (!order.txHash) continue;
      try {
        const confirmed = await this.isTransactionConfirmed(order.txHash);
        if (confirmed) {
          await this.withdrawalsService.confirmWithdrawalBySystem(order.id);
          this.logger.log(`Withdrawal ${order.id} confirmed on-chain`);
          // Fire-and-forget: look up user's telegramUserId and notify
          this.prisma.user
            .findUnique({ where: { id: order.userId }, select: { telegramUserId: true } })
            .then((u) => {
              if (u) {
                this.telegram.sendMessage(
                  u.telegramUserId,
                  this.telegram.msgWithdrawalConfirmed(
                    order.amount.toString(),
                    order.assetCode,
                    order.txHash ?? undefined,
                  ),
                );
              }
            })
            .catch((err) => this.logger.warn(`Notify withdrawal confirmation failed: ${err}`));
        }
      } catch (err) {
        this.logger.error(
          `Confirmation check failed for withdrawal ${order.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Verify that `txHash` appears in the hot wallet's recent outgoing transactions.
   */
  private async isTransactionConfirmed(txHash: string): Promise<boolean> {
    if (!this.hotWallet.isEnabled) return false;
    const { TONCENTER_API_URL, TONCENTER_API_KEY } = env();
    const hotWalletAddr = this.hotWallet.address.toString({ urlSafe: true, bounceable: false });

    const params = new URLSearchParams({ address: hotWalletAddr, limit: "50" });
    const headers: Record<string, string> = {};
    if (TONCENTER_API_KEY) headers["X-API-Key"] = TONCENTER_API_KEY;

    try {
      const res = await fetch(
        `${TONCENTER_API_URL}/getTransactions?${params}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return false;
      const json = (await res.json()) as {
        ok: boolean;
        result: Array<{ transaction_id: { hash: string } }>;
      };
      if (!json.ok) return false;
      return json.result.some((tx) => tx.transaction_id.hash === txHash);
    } catch {
      return false;
    }
  }
}
