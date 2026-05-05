import { Injectable, Logger } from "@nestjs/common";
import { Cell } from "@ton/ton";
import { env } from "../../config/env";

export interface ParsedDeposit {
  txHash: string;
  lt: string;
  fromAddress: string;
  /** "TON" or "USDT" — which asset was transferred */
  assetCode: "TON" | "USDT";
  /** Human-readable decimal string, e.g. "1.5" or "100.05" */
  amount: string;
}

interface TonCenterMsg {
  source: string;
  destination: string;
  value?: string; // nanotons as decimal string
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
const MAX_TXS_PER_SCAN = 50;

function bigintToDecimal(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
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
   * Returns up to MAX_TXS_PER_SCAN parsed deposits, sorted newest-first.
   *
   * @param expectedUsdtJettonWallet - The known USDT Jetton wallet address for this
   *   deposit address, or null to skip Jetton crediting entirely.
   */
  async getNewDeposits(
    address: string,
    lastLt: string,
    expectedUsdtJettonWallet: string | null,
  ): Promise<ParsedDeposit[]> {
    const { TONCENTER_API_URL, TONCENTER_API_KEY } = env();
    const params = new URLSearchParams({ address, limit: String(MAX_TXS_PER_SCAN) });
    if (lastLt !== "0") params.set("from_lt", lastLt);

    const url = `${TONCENTER_API_URL}/getTransactions?${params}`;
    const headers: Record<string, string> = {};
    if (TONCENTER_API_KEY) headers["X-API-Key"] = TONCENTER_API_KEY;

    let txs: TonCenterTx[];
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
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
      // After the external-message guard above, inMsg.source is guaranteed non-empty
      const fromAddress = inMsg.source;

      // Try USDT Jetton transfer notification first
      const jettonResult = this.tryParseJettonNotification(inMsg.msg_data);
      if (jettonResult !== null && jettonResult.amount > 0n) {
        // Verify the notification came from the known USDT Jetton wallet for this address
        if (!expectedUsdtJettonWallet || inMsg.source !== expectedUsdtJettonWallet) {
          continue; // Unknown Jetton token — skip
        }
        deposits.push({
          txHash,
          lt,
          fromAddress: jettonResult.sender, // real human sender, not the Jetton wallet contract
          assetCode: "USDT",
          amount: bigintToDecimal(jettonResult.amount, 6),
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

  /**
   * Resolve the USDT Jetton wallet address for a given TON user address by calling
   * the Jetton master contract's `get_wallet_address` getter.
   * Returns null if the call fails or the address cannot be resolved.
   */
  async getUsdtJettonWalletAddress(userTonAddress: string): Promise<string | null> {
    const { TONCENTER_API_URL, TONCENTER_API_KEY, USDT_JETTON_MASTER_ADDRESS } = env();
    const url = `${TONCENTER_API_URL}/runGetMethod`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (TONCENTER_API_KEY) headers["X-API-Key"] = TONCENTER_API_KEY;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          address: USDT_JETTON_MASTER_ADDRESS,
          method: "get_wallet_address",
          stack: [["tvm.Slice", userTonAddress]],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const json = await res.json() as { ok: boolean; result: { stack: Array<[string, string]> } };
      if (!json.ok || !json.result?.stack?.[0]) return null;
      return json.result.stack[0][1]; // address string
    } catch {
      return null;
    }
  }

  private tryParseJettonNotification(
    msgData: TonCenterMsg["msg_data"] | undefined,
  ): { amount: bigint; sender: string } | null {
    if (!msgData || msgData["@type"] !== "msg.dataRaw" || !msgData.body) return null;
    try {
      const cell = Cell.fromBoc(Buffer.from(msgData.body, "base64"))[0];
      const slice = cell.beginParse();
      if (slice.remainingBits < 96) return null; // op(32) + query_id(64)
      if (slice.loadUint(32) !== JETTON_TRANSFER_NOTIFICATION_OP) return null;
      slice.loadUint(64); // query_id — discard
      const amount = slice.loadCoins(); // amount in jetton units (bigint, 6 decimals for USDT)
      const sender = slice.loadAddress();
      return { amount, sender: sender.toString() };
    } catch {
      return null;
    }
  }
}
