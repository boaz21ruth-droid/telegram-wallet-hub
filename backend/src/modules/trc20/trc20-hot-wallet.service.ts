import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TronWeb } from "tronweb";
import { env } from "../../config/env";
import { parseUsdtAmountToUnits } from "./trc20-utils";

@Injectable()
export class Trc20HotWalletService implements OnModuleInit {
  private readonly logger = new Logger(Trc20HotWalletService.name);
  private tronWeb: TronWeb | null = null;
  private mnemonic = "";

  get isEnabled() {
    return this.tronWeb !== null;
  }

  onModuleInit() {
    const { TRC20_HOT_WALLET_MNEMONIC, TRONGRID_API_URL } = env();
    if (!TRC20_HOT_WALLET_MNEMONIC) {
      this.logger.warn(
        "TRC20_HOT_WALLET_MNEMONIC not set — TRC20 withdrawals + auto-address disabled",
      );
      return;
    }
    this.mnemonic = TRC20_HOT_WALLET_MNEMONIC.trim();
    const hotKey = this.derivePrivateKey(0);
    this.tronWeb = new TronWeb({ fullHost: TRONGRID_API_URL, privateKey: hotKey });
    const addr = this.tronWeb.defaultAddress.base58;
    this.logger.log(`TRC20 hot wallet ready: ${addr}`);
  }

  deriveDepositAddress(index: number): string {
    const account = TronWeb.fromMnemonic(this.mnemonic, `m/44'/195'/0'/0/${index}`);
    return account.address;
  }

  async getUsdtBalance(): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    const { TRC20_USDT_CONTRACT } = env();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = await (this.tronWeb as any).contract().at(TRC20_USDT_CONTRACT);
    const hotAddr = this.tronWeb.defaultAddress.base58;
    const rawBalance: string = await contract.balanceOf(hotAddr).call();
    const units = BigInt(rawBalance);
    return `${units / 1_000_000n}.${String(units % 1_000_000n).padStart(6, "0")}`;
  }

  async broadcastUsdtTransfer(toAddress: string, amount: string): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    const { TRC20_USDT_CONTRACT } = env();
    const amountUnits = parseUsdtAmountToUnits(amount);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = await (this.tronWeb as any).contract().at(TRC20_USDT_CONTRACT);
    const txId: string = await contract.transfer(toAddress, amountUnits.toString()).send();
    return txId;
  }

  // ── JustLend integration (P2-3 stubs) ─────────────────────────────────────

  async depositToJustLend(amount: string): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    const { JUSTLEND_USDT_MARKET } = env();
    if (!JUSTLEND_USDT_MARKET) throw new Error("JUSTLEND_USDT_MARKET not configured");
    this.logger.log(`[JustLend] depositToJustLend ${amount} USDT (stub)`);
    // TODO: call JustLend supply() on JUSTLEND_USDT_MARKET contract
    return "stub-txhash";
  }

  async withdrawFromJustLend(amount: string): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    const { JUSTLEND_USDT_MARKET } = env();
    if (!JUSTLEND_USDT_MARKET) throw new Error("JUSTLEND_USDT_MARKET not configured");
    this.logger.log(`[JustLend] withdrawFromJustLend ${amount} USDT (stub)`);
    // TODO: call JustLend redeemUnderlying() on JUSTLEND_USDT_MARKET contract
    return "stub-txhash";
  }

  async getJustLendBalance(): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    this.logger.log("[JustLend] getJustLendBalance (stub) → 0");
    // TODO: call jToken.balanceOfUnderlying() on JUSTLEND_USDT_MARKET contract
    return "0";
  }

  async getJustLendApy(): Promise<number> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    this.logger.log("[JustLend] getJustLendApy (stub) → 0.042");
    // TODO: compute from supplyRatePerBlock × blocks-per-year on JUSTLEND_USDT_MARKET
    return 0.042;
  }

  private derivePrivateKey(index: number): string {
    const account = TronWeb.fromMnemonic(this.mnemonic, `m/44'/195'/0'/0/${index}`);
    return account.privateKey.replace(/^0x/, "");
  }
}
