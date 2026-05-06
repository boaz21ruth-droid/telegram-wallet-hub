import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env";

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  /** Fire-and-forget. Never throws. */
  sendMessage(telegramUserId: string, text: string): void {
    const { TELEGRAM_BOT_TOKEN } = env();
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramUserId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          this.logger.warn(`Telegram notify failed uid=${telegramUserId}: ${res.status} ${body}`);
        }
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Telegram notify error uid=${telegramUserId}: ${err instanceof Error ? err.message : err}`,
        );
      });
  }

  msgTransferSent(amount: string, assetCode: string, recipientName: string): string {
    return `✅ 转账成功\n您已向 <b>${recipientName}</b> 转账 <b>${amount} ${assetCode}</b>。`;
  }

  msgTransferReceived(amount: string, assetCode: string, senderName: string): string {
    return `💰 收款通知\n您收到来自 <b>${senderName}</b> 的 <b>${amount} ${assetCode}</b>。`;
  }

  msgDepositCredited(amount: string, assetCode: string): string {
    return `✅ 充值到账\n您的账户已到账 <b>${amount} ${assetCode}</b>。`;
  }

  msgWithdrawalCreated(amount: string, assetCode: string, toAddress: string): string {
    return `📤 提现申请已提交\n金额：<b>${amount} ${assetCode}</b>\n地址：<code>${toAddress}</code>`;
  }

  msgWithdrawalApproved(amount: string, assetCode: string): string {
    return `✅ 提现已审核通过\n金额：<b>${amount} ${assetCode}</b>\n正在处理，请稍候。`;
  }

  msgWithdrawalRejected(amount: string, assetCode: string, reason?: string | null): string {
    const suffix = reason ? `\n原因：${reason}` : "";
    return `❌ 提现被拒绝\n金额：<b>${amount} ${assetCode}</b>${suffix}\n资金已退回您的账户。`;
  }

  msgWithdrawalConfirmed(amount: string, assetCode: string, txHash?: string | null): string {
    const suffix = txHash ? `\n交易哈希：<code>${txHash}</code>` : "";
    return `🎉 提现已到账\n金额：<b>${amount} ${assetCode}</b>${suffix}`;
  }
}
