import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { PriceService } from "./price.service";

function mockFetch(responseData: unknown, ok = true) {
  return mock.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => responseData,
  }));
}

describe("PriceService", () => {
  let svc: PriceService;

  beforeEach(() => {
    svc = new PriceService();
    // reset cache between tests
    (svc as unknown as { cache: Map<string, unknown> }).cache.clear();
  });

  it("USDT returns 1.0 without calling fetch", async () => {
    const fetchMock = mockFetch({});
    global.fetch = fetchMock as unknown as typeof fetch;
    const price = await svc.getUsdPrice("USDT");
    assert.equal(price, 1.0);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("getUsdPrice fetches and caches TON price", async () => {
    const fetchMock = mockFetch({ "the-open-network": { usd: 2.5 } });
    global.fetch = fetchMock as unknown as typeof fetch;
    const price1 = await svc.getUsdPrice("TON");
    const price2 = await svc.getUsdPrice("TON");
    assert.equal(price1, 2.5);
    assert.equal(price2, 2.5);
    assert.equal(fetchMock.mock.calls.length, 1, "fetch should be called only once due to cache");
  });

  it("getUsdPrice re-fetches after TTL expiry", async () => {
    const fetchMock = mockFetch({ "the-open-network": { usd: 2.5 } });
    global.fetch = fetchMock as unknown as typeof fetch;
    // Seed stale cache entry
    (svc as unknown as { cache: Map<string, unknown> }).cache.set("TON", {
      usdPrice: 2.0,
      fetchedAt: Date.now() - svc.TTL_MS - 1000,
    });
    const price = await svc.getUsdPrice("TON");
    assert.equal(price, 2.5);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("getUsdPrice throws for unknown asset", async () => {
    await assert.rejects(() => svc.getUsdPrice("BTC"), /Unsupported asset: BTC/);
  });

  it("getSwapQuote computes correct midRate, toAmount, feeAmount (100 USDT→TON at $2.50, spread 0.5%)", async () => {
    const fetchMock = mockFetch({ "the-open-network": { usd: 2.5 } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await svc.getSwapQuote({
      fromAssetCode: "USDT",
      fromNetwork: "TRC20",
      fromAmount: new Prisma.Decimal("100"),
      toAssetCode: "TON",
      toNetwork: "TON",
      spreadRate: new Prisma.Decimal("0.005"),
    });

    // midRate = 1.0 / 2.5 = 0.4
    assert.ok(result.midRate.equals(new Prisma.Decimal("0.4")), `midRate=${result.midRate}`);
    // grossOut = 100 * 0.4 = 40; fee = 40 * 0.005 = 0.2; toAmount = 39.8
    assert.ok(result.feeAmount.equals(new Prisma.Decimal("0.2")), `feeAmount=${result.feeAmount}`);
    assert.ok(result.toAmount.equals(new Prisma.Decimal("39.8")), `toAmount=${result.toAmount}`);
    assert.ok(result.expiresAt > new Date());
  });

  it("getSwapQuote includes fixedFee in feeAmount (bridge case)", async () => {
    const fetchMock = mockFetch({ "the-open-network": { usd: 2.5 } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await svc.getSwapQuote({
      fromAssetCode: "USDT",
      fromNetwork: "TRC20",
      fromAmount: new Prisma.Decimal("100"),
      toAssetCode: "TON",
      toNetwork: "TON",
      spreadRate: new Prisma.Decimal("0.005"),
      fixedFee: new Prisma.Decimal("0.1"),
    });

    // fee = 40 * 0.005 + 0.1 = 0.3; toAmount = 39.7
    assert.ok(result.feeAmount.equals(new Prisma.Decimal("0.3")), `feeAmount=${result.feeAmount}`);
    assert.ok(result.toAmount.equals(new Prisma.Decimal("39.7")), `toAmount=${result.toAmount}`);
  });
});
