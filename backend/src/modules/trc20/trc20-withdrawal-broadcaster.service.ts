import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { TelegramNotificationService } from "../../common/telegram/telegram-notification.service";
import { Trc20HotWalletService } from "./trc20-hot-wallet.service";
import { Trc20Service } from "./trc20.service";
import { hasSufficientBalance } from "./trc20-balance";

@Injectable()
export class Trc20WithdrawalBroadcasterService {
  private readonly logger = new Logger(Trc20WithdrawalBroadcasterService.name);
  private broadcasting = false;
  private confirming = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotWallet: Trc20HotWalletService,
    private readonly trc20Service: Trc20Service,
    private readonly withdrawalsService: WithdrawalsService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async broadcastPending() {
    if (!this.hotWallet.isEnabled || this.broadcasting) return;
    this.broadcasting = true;
    try {
      await this.runBroadcast();
    } catch (err) {
      this.logger.error(`TRC20 broadcast cycle failed: ${err}`);
    } finally {
      this.broadcasting = false;
    }
  }

  @Cron("0 */5 * * * *")
  async confirmSigned() {
    if (!this.hotWallet.isEnabled || this.confirming) return;
    this.confirming = true;
    try {
      await this.runConfirmation();
    } catch (err) {
      this.logger.error(`TRC20 confirmation cycle failed: ${err}`);
    } finally {
      this.confirming = false;
    }
  }

  private async runBroadcast() {
    const orders = await this.prisma.withdrawOrder.findMany({
      where: { status: "READY_FOR_SIGNING", network: "TRC20" },
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    if (orders.length === 0) return;

    const hotBalance = await this.hotWallet.getUsdtBalance().catch((err) => {
      this.logger.error(`Failed to fetch TRC20 hot wallet balance: ${err}`);
      return null;
    });
    if (hotBalance === null) return;

    for (const order of orders) {
      const fee = order.fee.toString();
      if (!hasSufficientBalance(hotBalance, order.amount.toString(), fee)) {
        this.logger.warn(
          `Hot wallet balance ${hotBalance} USDT insufficient for withdrawal ${order.id} ` +
          `(amount=${order.amount} fee=${fee}) — skipping`,
        );
        continue;
      }

      try {
        this.logger.log(
          `Broadcasting TRC20 withdrawal ${order.id}: ${order.amount} USDT → ${order.toAddress}`,
        );
        const txHash = await this.hotWallet.broadcastUsdtTransfer(
          order.toAddress,
          order.amount.toString(),
        );
        await this.withdrawalsService.signWithdrawalBySystem(order.id, txHash);
        this.logger.log(`TRC20 withdrawal ${order.id} signed — txHash=${txHash}`);
      } catch (err) {
        this.logger.error(
          `Failed to broadcast TRC20 withdrawal ${order.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async runConfirmation() {
    const orders = await this.prisma.withdrawOrder.findMany({
      where: { status: "SIGNED", network: "TRC20" },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });

    for (const order of orders) {
      if (!order.txHash) continue;
      try {
        const confirmed = await this.trc20Service.isTransactionConfirmed(order.txHash);
        if (confirmed) {
          await this.withdrawalsService.confirmWithdrawalBySystem(order.id);
          this.logger.log(`TRC20 withdrawal ${order.id} confirmed on-chain`);
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
            .catch((err) => this.logger.warn(`Notify TRC20 withdrawal confirmation failed: ${err}`));
        }
      } catch (err) {
        this.logger.error(
          `TRC20 confirmation check failed for withdrawal ${order.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
