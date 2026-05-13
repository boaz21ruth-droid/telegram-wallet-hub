import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { SwapService } from "./swap.service";

function makeWalletAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "wa-1",
    userId: "user-1",
    assetCode: "USDT",
    network: "TRC20",
    status: "ACTIVE",
    availableBalance: new Prisma.Decimal("500"),
    ...overrides,
  };
}

type TxWalletAccount = {
  findUnique: ReturnType<typeof mock.fn>;
  updateMany: ReturnType<typeof mock.fn>;
  update: ReturnType<typeof mock.fn>;
};

type TxSwapOrder = {
  create: ReturnType<typeof mock.fn>;
  update: ReturnType<typeof mock.fn>;
};

type MockTx = {
  walletAccount: TxWalletAccount;
  swapOrder: TxSwapOrder;
  ledgerJournal: { create: ReturnType<typeof mock.fn> };
};

function makeTx(fromAccount: unknown, toAccount: unknown): MockTx {
  return {
    walletAccount: {
      findUnique: mock.fn(async (q: { where: { userId_assetCode_network: { assetCode: string; network: string } } }) => {
        const { assetCode, network } = q.where.userId_assetCode_network;
        if (assetCode === "USDT" && network === "TRC20") return fromAccount;
        if (assetCode === "TON" && network === "TON") return toAccount;
        return null;
      }),
      updateMany: mock.fn(async () => ({ count: 1 })),
      update: mock.fn(async (q: { data: unknown }) => ({ ...(toAccount as object), ...(q.data as object) })),
    },
    swapOrder: {
      create: mock.fn(async (q: { data: unknown }) => ({ id: "so-1", ...(q.data as object) })),
      update: mock.fn(async (q: { data: unknown }) => ({ id: "so-1", ...(q.data as object) })),
    },
    ledgerJournal: {
      create: mock.fn(async () => ({ id: "j-1" })),
    },
  };
}

function makePrismaMock(fromAccount: unknown, toAccount: unknown) {
  const tx = makeTx(fromAccount, toAccount);
  return {
    swapOrder: {
      findUnique: mock.fn(async () => null) as ReturnType<typeof mock.fn>,
    },
    $transaction: mock.fn(async (fn: (tx: MockTx) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  };
}

function makePriceServiceMock() {
  return {
    getSwapQuote: mock.fn(async () => ({
      midRate: new Prisma.Decimal("0.4"),
      toAmount: new Prisma.Decimal("39.8"),
      feeAmount: new Prisma.Decimal("0.2"),
      expiresAt: new Date(Date.now() + 30_000),
    })),
    getUsdPrice: mock.fn(async () => 1.0),
  };
}

function makeLedgerMock() {
  return { recordSwap: mock.fn(async () => ({ id: "j-1" })) };
}

const baseDto = {
  fromAssetCode: "USDT",
  fromNetwork: "TRC20",
  fromAmount: "100",
  toAssetCode: "TON",
  toNetwork: "TON",
  minToAmount: "39",
  bizNo: "biz-1",
};

describe("SwapService.createSwap", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let priceService: ReturnType<typeof makePriceServiceMock>;
  let ledgerService: ReturnType<typeof makeLedgerMock>;
  let svc: SwapService;

  beforeEach(() => {
    prisma = makePrismaMock(
      makeWalletAccount({ id: "wa-from", assetCode: "USDT", network: "TRC20" }),
      makeWalletAccount({ id: "wa-to", assetCode: "TON", network: "TON" }),
    );
    priceService = makePriceServiceMock();
    ledgerService = makeLedgerMock();
    svc = new SwapService(prisma as never, priceService as never, ledgerService as never);
    process.env.SWAP_SPREAD_RATE = "0.005";
    process.env.BRIDGE_SPREAD_RATE = "0.002";
    process.env.BRIDGE_FIXED_FEE_USDT = "0.5";
  });

  it("returns existing order when bizNo already exists (idempotency)", async () => {
    const existing = { id: "so-existing", bizNo: "biz-1" };
    prisma.swapOrder.findUnique = mock.fn(async () => existing as unknown as null);
    const result = await svc.createSwap("user-1", baseDto);
    assert.deepEqual(result, existing);
    assert.equal(prisma.$transaction.mock.calls.length, 0);
  });

  it("creates swap order with correct amounts", async () => {
    await svc.createSwap("user-1", baseDto);
    const tx = prisma._tx;
    const createCall = tx.swapOrder.create.mock.calls[0] as unknown as { arguments: [{ data: { fromAmount: Prisma.Decimal; toAmount: Prisma.Decimal } }] };
    const data = createCall.arguments[0].data;
    assert.ok(data.fromAmount.equals(new Prisma.Decimal("100")));
    assert.ok(data.toAmount.equals(new Prisma.Decimal("39.8")));
  });

  it("throws when available balance is insufficient", async () => {
    prisma._tx.walletAccount.updateMany = mock.fn(async () => ({ count: 0 }));
    await assert.rejects(() => svc.createSwap("user-1", baseDto), /Insufficient available balance/);
  });

  it("throws when toAmount is below minToAmount (slippage protection)", async () => {
    const dto = { ...baseDto, minToAmount: "50" };
    await assert.rejects(() => svc.createSwap("user-1", dto), /slippage/i);
  });

  it("records ledger journal", async () => {
    await svc.createSwap("user-1", baseDto);
    assert.equal(ledgerService.recordSwap.mock.calls.length, 1);
  });
});

describe("SwapService.getQuote", () => {
  it("delegates to PriceService with correct spread", async () => {
    process.env.SWAP_SPREAD_RATE = "0.005";
    process.env.BRIDGE_SPREAD_RATE = "0.002";
    process.env.BRIDGE_FIXED_FEE_USDT = "0.5";
    const prisma = makePrismaMock(null, null);
    const priceService = makePriceServiceMock();
    const svc = new SwapService(prisma as never, priceService as never, makeLedgerMock() as never);

    await svc.getQuote({
      fromAssetCode: "USDT",
      fromNetwork: "TRC20",
      fromAmount: "100",
      toAssetCode: "TON",
      toNetwork: "TON",
    });

    assert.equal(priceService.getSwapQuote.mock.calls.length, 1);
    const callArgs = (priceService.getSwapQuote.mock.calls[0] as unknown as { arguments: [{ spreadRate: Prisma.Decimal }] }).arguments[0];
    assert.ok(callArgs.spreadRate.equals(new Prisma.Decimal("0.005")));
  });
});
