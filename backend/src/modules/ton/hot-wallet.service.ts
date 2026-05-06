import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  TonClient,
  WalletContractV4,
  internal,
  toNano,
  Address,
  beginCell,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "../../config/env";

@Injectable()
export class HotWalletService implements OnModuleInit {
  private readonly logger = new Logger(HotWalletService.name);
  private client!: TonClient;
  private wallet!: WalletContractV4;
  private secretKey!: Buffer;
  private hotWalletAddress!: Address;
  /** Cached Jetton wallet address for the hot wallet's USDT */
  private usdtJettonWalletAddress: Address | null = null;
  private enabled = false;

  async onModuleInit() {
    const { TONCENTER_API_URL, TONCENTER_API_KEY, TON_HOT_WALLET_MNEMONIC } = env();

    if (!TON_HOT_WALLET_MNEMONIC) {
      this.logger.warn(
        "TON_HOT_WALLET_MNEMONIC not set — withdrawal broadcasting disabled",
      );
      return;
    }

    this.client = new TonClient({
      endpoint: `${TONCENTER_API_URL}/jsonRPC`,
      apiKey: TONCENTER_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(TON_HOT_WALLET_MNEMONIC.trim().split(/\s+/));
    this.secretKey = Buffer.from(keyPair.secretKey);
    this.wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    this.hotWalletAddress = this.wallet.address;
    this.enabled = true;

    this.logger.log(`Hot wallet ready: ${this.hotWalletAddress.toString()}`);
  }

  get isEnabled() {
    return this.enabled;
  }

  get address(): Address {
    return this.hotWalletAddress;
  }

  /**
   * Broadcast a native TON transfer.
   * Returns the on-chain txHash once the external message is processed (≤30 s).
   */
  async broadcastTonTransfer(toAddress: string, amount: string): Promise<string> {
    this.assertPositiveAmount(amount);
    this.assertEnabled();
    const contract = this.client.open(this.wallet);
    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
      seqno,
      secretKey: this.secretKey,
      messages: [
        internal({
          to: Address.parse(toAddress),
          value: toNano(amount),
          bounce: false,
        }),
      ],
    });

    return this.waitForTxHash(seqno);
  }

  /**
   * Broadcast a USDT Jetton transfer from the hot wallet's Jetton wallet.
   * Returns the on-chain txHash once processed.
   */
  async broadcastUsdtTransfer(toAddress: string, amount: string): Promise<string> {
    this.assertPositiveAmount(amount);
    this.assertEnabled();
    const jettonWalletAddr = await this.getUsdtJettonWalletAddress();
    const contract = this.client.open(this.wallet);
    const seqno = await contract.getSeqno();

    // Jetton transfer op: 0xf8a7ea5
    const transferBody = beginCell()
      .storeUint(0xf8a7ea5, 32)             // op: transfer
      .storeUint(0n, 64)                    // query_id
      .storeCoins(this.usdtUnits(amount))   // amount in Jetton units (6 decimals)
      .storeAddress(Address.parse(toAddress))    // destination
      .storeAddress(this.hotWalletAddress)       // response_destination (excess gas return)
      .storeBit(false)                      // no custom_payload
      .storeCoins(1n)                       // forward_ton_amount (1 nanoton for notification)
      .storeBit(false)                      // no forward_payload
      .endCell();

    await contract.sendTransfer({
      seqno,
      secretKey: this.secretKey,
      messages: [
        internal({
          to: jettonWalletAddr,
          value: toNano("0.07"), // gas for the Jetton transfer
          bounce: true,
          body: transferBody,
        }),
      ],
    });

    return this.waitForTxHash(seqno);
  }

  /**
   * Poll the hot wallet seqno until it advances past `sentSeqno`,
   * then find the resulting transaction and return its hash.
   * Timeout: 30 s.
   */
  private async waitForTxHash(sentSeqno: number): Promise<string> {
    const contract = this.client.open(this.wallet);
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3_000));
      const currentSeqno = await contract.getSeqno();
      if (currentSeqno > sentSeqno) break;
    }

    if (Date.now() >= deadline) {
      throw new Error("Timed out (30s) waiting for seqno to advance after broadcast");
    }

    // Fetch the hot wallet's most recent transactions to find our outgoing tx
    const txs = await this.client.getTransactions(this.hotWalletAddress, { limit: 5 });
    if (!txs.length) throw new Error("Could not find broadcast transaction on chain");

    // The most recent tx is ours (seqno just advanced)
    const txHash = Buffer.from(txs[0].hash()).toString("hex");
    return txHash;
  }

  private async getUsdtJettonWalletAddress(): Promise<Address> {
    if (this.usdtJettonWalletAddress) return this.usdtJettonWalletAddress;

    const { USDT_JETTON_MASTER_ADDRESS } = env();
    const result = await this.client.runMethod(
      Address.parse(USDT_JETTON_MASTER_ADDRESS),
      "get_wallet_address",
      [{ type: "slice", cell: beginCell().storeAddress(this.hotWalletAddress).endCell() }],
    );
    const addr = result.stack.readAddress();
    this.usdtJettonWalletAddress = addr;
    return addr;
  }

  private usdtUnits(amount: string): bigint {
    // amount is a decimal string like "100.5"; convert to 6-decimal integer
    const [whole, frac = ""] = amount.split(".");
    const fracPadded = frac.padEnd(6, "0").slice(0, 6);
    return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new Error("Hot wallet is not configured (TON_HOT_WALLET_MNEMONIC missing)");
    }
  }

  private assertPositiveAmount(amount: string) {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) {
      throw new Error(`Invalid transfer amount: ${amount}`);
    }
  }
}
