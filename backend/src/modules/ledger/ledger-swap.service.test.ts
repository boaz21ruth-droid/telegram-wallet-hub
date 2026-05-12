import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LedgerEntryDirection, JournalType } from "@prisma/client";
import { LedgerService } from "./ledger.service";
import { Prisma } from "@prisma/client";

function makeTx() {
  return {
    ledgerJournal: {
      // Return the input data so tests can inspect what was passed
      create: async (args: { data: unknown }) => args.data,
    },
  };
}

describe("LedgerService.recordSwap", () => {
  const svc = new LedgerService();
  const baseParams = {
    swapOrderId: "swap-1",
    fromWalletAccountId: "wa-from",
    toWalletAccountId: "wa-to",
    fromAssetCode: "USDT",
    fromNetwork: "TRC20",
    toAssetCode: "TON",
    toNetwork: "TON",
    fromAmount: new Prisma.Decimal("100"),
    toAmount: new Prisma.Decimal("39.8"),
    feeAmount: new Prisma.Decimal("0.2"),
    isBridge: false,
  };

  it("creates journal with type=SWAP and correct referenceId", async () => {
    const tx = makeTx();
    const result = await svc.recordSwap(tx as never, baseParams) as unknown as { type: string; referenceId: string };
    assert.equal(result.type, JournalType.SWAP);
    assert.equal(result.referenceId, "swap-1");
  });

  it("creates exactly 4 LedgerEntry rows", async () => {
    const tx = makeTx();
    const result = await svc.recordSwap(tx as never, baseParams) as unknown as { entries: { create: unknown[] } };
    assert.equal(result.entries.create.length, 4);
  });

  it("uses PLATFORM_SWAP_FEE for non-bridge swaps", async () => {
    const tx = makeTx();
    const result = await svc.recordSwap(tx as never, { ...baseParams, isBridge: false }) as unknown as { entries: { create: Array<{ ledgerAccountCode: string }> } };
    assert.ok(result.entries.create.some((e) => e.ledgerAccountCode === "PLATFORM_SWAP_FEE"));
  });

  it("uses PLATFORM_BRIDGE_FEE for bridge swaps", async () => {
    const tx = makeTx();
    const result = await svc.recordSwap(tx as never, { ...baseParams, isBridge: true }) as unknown as { entries: { create: Array<{ ledgerAccountCode: string }> } };
    assert.ok(result.entries.create.some((e) => e.ledgerAccountCode === "PLATFORM_BRIDGE_FEE"));
  });

  it("toAsset debits equal toAsset credits (PLATFORM_RESERVE DEBIT grossOut = fee + toAmount)", async () => {
    const tx = makeTx();
    const result = await svc.recordSwap(tx as never, baseParams) as unknown;
    type Entry = { direction: LedgerEntryDirection; amount: Prisma.Decimal; assetCode: string };
    const entries = (result as { entries: { create: Entry[] } }).entries.create;
    const toAssetEntries = entries.filter((e) => e.assetCode === "TON");
    const debits = toAssetEntries
      .filter((e) => e.direction === LedgerEntryDirection.DEBIT)
      .reduce((s, e) => s.add(e.amount), new Prisma.Decimal(0));
    const credits = toAssetEntries
      .filter((e) => e.direction === LedgerEntryDirection.CREDIT)
      .reduce((s, e) => s.add(e.amount), new Prisma.Decimal(0));
    assert.ok(debits.equals(credits), `debits ${debits} !== credits ${credits}`);
  });
});
