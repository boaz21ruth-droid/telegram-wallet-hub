import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { Prisma, StakingOrderStatus, WalletAccountStatus } from "@prisma/client";
import { StakingService } from "./staking.service";

function makeProduct(overrides: Partial<{
  id: string; assetCode: string; network: string; isActive: boolean;
  minAmount: string; maxAmount: string | null; totalCap: string | null;
  lockDays: number; productType: string; currentApy: string;
}> = {}) {
  return {
    id: "prod-1",
    name: "USDT活期",
    assetCode: "USDT",
    network: "TRC20",
    productType: "FLEXIBLE",
    minAmount: new Prisma.Decimal("10"),
    maxAmount: null,
    totalCap: null,
    lockDays: 0,
    currentApy: new Prisma.Decimal("0.042"),
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    ...(overrides.minAmount ? { minAmount: new Prisma.Decimal(overrides.minAmount) } : {}),
    ...(overrides.maxAmount ? { maxAmount: new Prisma.Decimal(overrides.maxAmount) } : {}),
    ...(overrides.totalCap ? { totalCap: new Prisma.Decimal(overrides.totalCap) } : {}),
  };
}

function makeAccount(balance = "500") {
  return {
    id: "acct-1",
    userId: "user-1",
    assetCode: "USDT",
    network: "TRC20",
    availableBalance: new Prisma.Decimal(balance),
    frozenBalance: new Prisma.Decimal("0"),
    stakedBalance: new Prisma.Decimal("0"),
    status: WalletAccountStatus.ACTIVE,
  };
}

function makeOrder(overrides: Partial<{ status: StakingOrderStatus }> = {}) {
  return {
    id: "order-1",
    userId: "user-1",
    productId: "prod-1",
    product: makeProduct(),
    assetCode: "USDT",
    network: "TRC20",
    principal: new Prisma.Decimal("100"),
    accruedYield: new Prisma.Decimal("0"),
    lockJournalId: null,
    unlockJournalId: null,
    lastYieldAt: null,
    nextYieldAt: new Date(),
    maturesAt: null,
    redeemRequestedAt: null,
    status: StakingOrderStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma(product: ReturnType<typeof makeProduct> | null, account: ReturnType<typeof makeAccount> | null) {
  const tx = {
    walletAccount: {
      findUnique: mock.fn(async () => account),
      updateMany: mock.fn(async () => ({ count: 1 })),
      update: mock.fn(async () => account),
    },
    stakingOrder: {
      create: mock.fn(async (args: { data: Record<string, unknown> }) => ({ id: "order-1", ...args.data })),
      findUniqueOrThrow: mock.fn(async () => ({ ...makeOrder(), product: product })),
      update: mock.fn(async (args: { data: Record<string, unknown> }) => ({ ...makeOrder(), ...args.data })),
    },
    ledgerJournal: {
      create: mock.fn(async () => ({ id: "journal-1" })),
    },
  };
  return {
    _tx: tx,
    stakingProduct: {
      findUnique: mock.fn(async () => product),
      findMany: mock.fn(async () => [product]),
    },
    stakingOrder: {
      findUnique: mock.fn(async (args: { where: { id?: string } }) => args.where.id === "order-1" ? makeOrder() : null),
      findMany: mock.fn(async () => [makeOrder()]),
      aggregate: mock.fn(async () => ({ _sum: { principal: new Prisma.Decimal("0") } })),
    },
    $transaction: mock.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
}

function makeLedger() {
  return {
    recordStakingLock: mock.fn(async () => ({ id: "journal-1" })),
    recordStakingUnlock: mock.fn(async () => ({ id: "journal-2" })),
  };
}

describe("StakingService.stakeAsset", () => {
  it("creates a staking order and deducts available balance", async () => {
    const prisma = makePrisma(makeProduct(), makeAccount("500"));
    const ledger = makeLedger();
    const svc = new StakingService(prisma as never, ledger as never);

    await svc.stakeAsset("user-1", { productId: "prod-1", amount: "100" });

    const updateManyCall = prisma._tx.walletAccount.updateMany.mock.calls[0] as unknown as {
      arguments: [{ where: { availableBalance: { gte: Prisma.Decimal } }; data: { availableBalance: { decrement: Prisma.Decimal } } }];
    };
    const where = updateManyCall.arguments[0].where;
    assert.ok(new Prisma.Decimal(where.availableBalance.gte).gte(new Prisma.Decimal("100")));
    assert.equal(ledger.recordStakingLock.mock.calls.length, 1);
  });

  it("throws when product is not found", async () => {
    const prisma = makePrisma(null, makeAccount("500"));
    const svc = new StakingService(prisma as never, makeLedger() as never);
    await assert.rejects(() => svc.stakeAsset("user-1", { productId: "prod-x", amount: "100" }), /not found/i);
  });

  it("throws when amount is below minimum", async () => {
    const prisma = makePrisma(makeProduct({ minAmount: "50" }), makeAccount("500"));
    const svc = new StakingService(prisma as never, makeLedger() as never);
    await assert.rejects(() => svc.stakeAsset("user-1", { productId: "prod-1", amount: "10" }), /Minimum/);
  });

  it("throws when balance update returns count 0", async () => {
    const prisma = makePrisma(makeProduct(), makeAccount("50"));
    prisma._tx.walletAccount.updateMany = mock.fn(async () => ({ count: 0 }));
    const svc = new StakingService(prisma as never, makeLedger() as never);
    await assert.rejects(() => svc.stakeAsset("user-1", { productId: "prod-1", amount: "100" }), /Insufficient/);
  });
});

describe("StakingService.redeemStaking", () => {
  it("releases balance and marks order REDEEMED", async () => {
    const prisma = makePrisma(makeProduct(), makeAccount("0"));
    const ledger = makeLedger();
    const svc = new StakingService(prisma as never, ledger as never);

    await svc.redeemStaking("user-1", "order-1");

    assert.equal(ledger.recordStakingUnlock.mock.calls.length, 1);
    const updateArgs = prisma._tx.stakingOrder.update.mock.calls[0] as unknown as {
      arguments: [{ data: { status: StakingOrderStatus } }];
    };
    assert.equal(updateArgs.arguments[0].data.status, StakingOrderStatus.REDEEMED);
  });

  it("throws when order not found", async () => {
    const prisma = makePrisma(makeProduct(), makeAccount("0"));
    prisma.stakingOrder.findUnique = mock.fn(async () => null);
    const svc = new StakingService(prisma as never, makeLedger() as never);
    await assert.rejects(() => svc.redeemStaking("user-1", "order-x"), /not found/i);
  });

  it("throws when order does not belong to user", async () => {
    const prisma = makePrisma(makeProduct(), makeAccount("0"));
    const orderOtherUser = { ...makeOrder(), userId: "other-user" };
    prisma.stakingOrder.findUnique = mock.fn(async () => orderOtherUser);
    const svc = new StakingService(prisma as never, makeLedger() as never);
    await assert.rejects(() => svc.redeemStaking("user-1", "order-1"), /Forbidden/i);
  });
});
