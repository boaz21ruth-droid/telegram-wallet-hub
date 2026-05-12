import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const COIN_IDS: Record<string, string> = {
  USDT: "tether",
  TON: "the-open-network",
};

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

interface CacheEntry {
  usdPrice: number;
  fetchedAt: number;
}

@Injectable()
export class PriceService {
  private cache: Map<string, CacheEntry> = new Map();
  readonly TTL_MS = 60_000;

  async getUsdPrice(assetCode: string): Promise<number> {
    if (!(assetCode in COIN_IDS)) {
      throw new Error(`Unsupported asset: ${assetCode}`);
    }
    // USDT is always $1 — skip API call
    if (assetCode === "USDT") return 1.0;

    const cached = this.cache.get(assetCode);
    if (cached && Date.now() - cached.fetchedAt < this.TTL_MS) {
      return cached.usdPrice;
    }

    const coinId = COIN_IDS[assetCode];
    const res = await fetch(`${COINGECKO_URL}?ids=${coinId}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);

    const data = (await res.json()) as Record<string, { usd: number } | undefined>;
    const entry = data[coinId];
    if (!entry || typeof entry.usd !== "number") {
      throw new Error(`CoinGecko returned no price for ${assetCode}`);
    }

    this.cache.set(assetCode, { usdPrice: entry.usd, fetchedAt: Date.now() });
    return entry.usd;
  }

  async getSwapQuote(params: {
    fromAssetCode: string;
    fromNetwork: string;
    fromAmount: Prisma.Decimal;
    toAssetCode: string;
    toNetwork: string;
    spreadRate: Prisma.Decimal;
    fixedFee?: Prisma.Decimal;
  }): Promise<{
    midRate: Prisma.Decimal;
    toAmount: Prisma.Decimal;
    feeAmount: Prisma.Decimal;
    expiresAt: Date;
  }> {
    const [fromUsd, toUsd] = await Promise.all([
      this.getUsdPrice(params.fromAssetCode),
      this.getUsdPrice(params.toAssetCode),
    ]);

    const midRate = new Prisma.Decimal(fromUsd).div(new Prisma.Decimal(toUsd));
    const grossOut = params.fromAmount.mul(midRate);
    const fixedFee = params.fixedFee ?? new Prisma.Decimal(0);
    const feeAmount = grossOut.mul(params.spreadRate).add(fixedFee);
    const toAmount = grossOut.sub(feeAmount);

    return { midRate, toAmount, feeAmount, expiresAt: new Date(Date.now() + 30_000) };
  }
}
