import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TronWeb } from "tronweb";
import { env } from "../../config/env";

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

  async broadcastUsdtTransfer(toAddress: string, amount: string): Promise<string> {
    if (!this.tronWeb) throw new Error("TRC20 hot wallet not configured");
    const { TRC20_USDT_CONTRACT } = env();
    const amountUnits = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = await (this.tronWeb as any).contract().at(TRC20_USDT_CONTRACT);
    const txId: string = await contract.transfer(toAddress, amountUnits.toString()).send();
    return txId;
  }

  private derivePrivateKey(index: number): string {
    const account = TronWeb.fromMnemonic(this.mnemonic, `m/44'/195'/0'/0/${index}`);
    return account.privateKey.replace(/^0x/, "");
  }
}
