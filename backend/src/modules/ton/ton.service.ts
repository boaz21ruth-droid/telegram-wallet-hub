import { Injectable, Logger } from "@nestjs/common";
import { Cell } from "@ton/ton";
import { env } from "../../config/env";

export interface ParsedDeposit {
  txHash: string;
  lt: string;
  fromAddress: string | null;
  /** "TON" or "USDT" — which asset was transferred */
  assetCode: "TON" | "USDT";
  /** Human-readable decimal string, e.g. "1.5" or "100.05" */
  amount: string;
}

interface TonCenterMsg {
  source: string;
  destination: string;
  value: string; // nanotons as decimal string
  msg_data: {
    "@type": "msg.dataText" | "msg.dataRaw" | "msg.dataEncryptedText";
    text?: string;
    body?: string; // base64-encoded BOC for dataRaw
  };
}

interface TonCenterTx {
  transaction_id: { lt: string; hash: string };
  in_msg: TonCenterMsg | null;
}

const JETTON_TRANSFER_NOTIFICATION_OP = 0x7362d09c;
const DUST_THRESHOLD_NANOTONS = 10_000_000n; // 0.01 TON — ignore gas-only messages

function bigintToDecimal(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

@Injectable()
export class TonService {
  private readonly logger = new Logger(TonService.name);

  /**
   * Fetch transactions on `address` that are newer than `lastLt` (exclusive).
   * Returns up to 50 parsed deposits, sorted newest-first.
   */
  async getNewDeposits(address: string, lastLt: string): Promise<ParsedDeposit[]> {
    const { TONCENTER_API_URL, TONCENTER_API_KEY } = env();
    const params = new URLSearchParams({ address, limit: "50" });
    if (lastLt !== "0") params.set("to_lt", lastLt);

    const url = `${TONCENTER_API_URL}/getTransactions?${params}`;
    const headers: Record<string, string> = {};
    if (TONCENTER_API_KEY) headers["X-API-Key"] = TONCENTER_API_KEY;

    let txs: TonCenterTx[];
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        this.logger.warn(`TonCenter ${res.status} for address ${address}`);
        return [];
      }
      const json = (await res.json()) as { ok: boolean; result: TonCenterTx[] };
      if (!json.ok || !Array.isArray(json.result)) return [];
      txs = json.result;
    } catch (err) {
      this.logger.error(`TonCenter fetch error for ${address}: ${err}`);
      return [];
    }

    const deposits: ParsedDeposit[] = [];

    for (const tx of txs) {
      const inMsg = tx.in_msg;
      // Skip: no incoming message, or external (source is empty string for externals)
      if (!inMsg || inMsg.source === "") continue;

      const txHash = tx.transaction_id.hash;
      const lt = tx.transaction_id.lt;
      const fromAddress = inMsg.source || null;

      // Try USDT Jetton transfer notification first
      const jettonAmount = this.tryParseJettonNotification(inMsg.msg_data);
      if (jettonAmount !== null && jettonAmount > 0n) {
        deposits.push({
          txHash,
          lt,
          fromAddress,
          assetCode: "USDT",
          amount: bigintToDecimal(jettonAmount, 6),
        });
        continue;
      }

      // TON native transfer — skip dust (gas payments from Jetton transfers appear as tiny TON)
      const valueNano = BigInt(inMsg.value ?? "0");
      if (valueNano > DUST_THRESHOLD_NANOTONS) {
        deposits.push({
          txHash,
          lt,
          fromAddress,
          assetCode: "TON",
          amount: bigintToDecimal(valueNano, 9),
        });
      }
    }

    return deposits;
  }

  private tryParseJettonNotification(
    msgData: TonCenterMsg["msg_data"] | undefined,
  ): bigint | null {
    if (!msgData || msgData["@type"] !== "msg.dataRaw" || !msgData.body) return null;
    try {
      const cell = Cell.fromBoc(Buffer.from(msgData.body, "base64"))[0];
      const slice = cell.beginParse();
      if (slice.remainingBits < 96) return null; // too short
      if (slice.loadUint(32) !== JETTON_TRANSFER_NOTIFICATION_OP) return null;
      slice.loadUint(64); // query_id — discard
      return slice.loadCoins(); // amount in jetton units (bigint, 6 decimals for USDT)
    } catch {
      return null;
    }
  }
}
