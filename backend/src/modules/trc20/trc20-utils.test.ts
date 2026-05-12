import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseUsdtAmountToUnits, isAboveDustThreshold, DUST_THRESHOLD_USDT } from "./trc20-utils";

describe("parseUsdtAmountToUnits", () => {
  test("converts a whole number to micro-units", () => {
    assert.equal(parseUsdtAmountToUnits("10"), 10_000_000n);
  });

  test("converts a decimal amount to micro-units", () => {
    assert.equal(parseUsdtAmountToUnits("10.5"), 10_500_000n);
  });

  test("handles six decimal places exactly", () => {
    assert.equal(parseUsdtAmountToUnits("0.000001"), 1n);
  });

  test("throws on zero amount", () => {
    assert.throws(() => parseUsdtAmountToUnits("0"), /invalid/i);
  });

  test("throws on negative amount", () => {
    assert.throws(() => parseUsdtAmountToUnits("-1"), /invalid/i);
  });

  test("throws on non-numeric string", () => {
    assert.throws(() => parseUsdtAmountToUnits("abc"), /invalid/i);
  });

  test("throws on NaN string", () => {
    assert.throws(() => parseUsdtAmountToUnits("NaN"), /invalid/i);
  });
});

describe("isAboveDustThreshold", () => {
  test("DUST_THRESHOLD_USDT is 0.01", () => {
    assert.equal(DUST_THRESHOLD_USDT, "0.01");
  });

  test("amount equal to threshold is accepted", () => {
    assert.equal(isAboveDustThreshold("0.01"), true);
  });

  test("amount above threshold is accepted", () => {
    assert.equal(isAboveDustThreshold("1.00"), true);
  });

  test("amount below threshold is rejected", () => {
    assert.equal(isAboveDustThreshold("0.009999"), false);
  });

  test("zero is rejected", () => {
    assert.equal(isAboveDustThreshold("0"), false);
  });
});

describe("deposit assetCode filtering", () => {
  test("filters deposits whose assetCode does not match the wallet account", () => {
    const { filterDepositsByAsset } = require("./trc20-utils");
    const deposits = [
      { assetCode: "USDT", amount: "1.0", txHash: "a" },
      { assetCode: "OTHER", amount: "2.0", txHash: "b" },
    ];
    const result = filterDepositsByAsset(deposits, "USDT");
    assert.equal(result.length, 1);
    assert.equal(result[0].txHash, "a");
  });

  test("returns empty array when no deposits match", () => {
    const { filterDepositsByAsset } = require("./trc20-utils");
    const result = filterDepositsByAsset([{ assetCode: "OTHER", amount: "1", txHash: "x" }], "USDT");
    assert.equal(result.length, 0);
  });
});
