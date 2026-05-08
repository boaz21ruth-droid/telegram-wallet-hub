import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env";

interface Trc20Deposit {
  txHash: string;
  fromAddress: string;
  amount: string;
  blockTimestampMs: bigint;
}

@Injectable()
export class Trc20Service {
  private readonly logger = new Logger(Trc20Service.name);

  async getNewDeposits(address: string, lastScannedLt: string): Promise<Trc20Deposit[]> {
    const { TRONGRID_API_URL, TRONGRID_API_KEY, TRC20_USDT_CONTRACT } = env();

    // On first scan (lastScannedLt="0") start from 60s ago to avoid scanning all history
    const minTs = lastScannedLt === "0" ? Date.now() - 60_000 : parseInt(lastScannedLt) + 1;

    const params = new URLSearchParams({
      contract_address: TRC20_USDT_CONTRACT,
      only_to: "true",
      limit: "200",
      min_timestamp: String(minTs),
      order_by: "block_timestamp,asc",
    });

    const headers: Record<string, string> = {};
    if (TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = TRONGRID_API_KEY;

    const res = await fetch(
      `${TRONGRID_API_URL}/v1/accounts/${address}/transactions/trc20?${params}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) throw new Error(`TronGrid ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as {
      data: Array<{
        transaction_id: string;
        from: string;
        value: string;
        block_timestamp: number;
      }>;
      success: boolean;
    };

    if (!json.success) return [];

    return json.data.map((tx) => ({
      txHash: tx.transaction_id,
      fromAddress: tx.from,
      amount: this.formatAmount(tx.value),
      blockTimestampMs: BigInt(tx.block_timestamp),
    }));
  }

  async isTransactionConfirmed(txHash: string): Promise<boolean> {
    const { TRONGRID_API_URL, TRONGRID_API_KEY } = env();
    const headers: Record<string, string> = {};
    if (TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = TRONGRID_API_KEY;

    try {
      const res = await fetch(`${TRONGRID_API_URL}/v1/transactions/${txHash}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as {
        data: Array<{ ret: Array<{ contractRet: string }> }>;
        success: boolean;
      };
      if (!json.success || !json.data.length) return false;
      return json.data[0].ret?.[0]?.contractRet === "SUCCESS";
    } catch {
      return false;
    }
  }

  private formatAmount(raw: string): string {
    const n = BigInt(raw);
    return `${n / 1_000_000n}.${String(n % 1_000_000n).padStart(6, "0")}`;
  }
}
