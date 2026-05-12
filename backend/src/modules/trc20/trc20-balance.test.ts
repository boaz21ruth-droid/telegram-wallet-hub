import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hasSufficientBalance } from "./trc20-balance";

describe("hasSufficientBalance", () => {
  test("returns true when balance exceeds required amount plus fee", () => {
    assert.equal(hasSufficientBalance("100.00", "10.00", "2.00"), true);
  });

  test("returns true when balance equals required amount plus fee exactly", () => {
    assert.equal(hasSufficientBalance("12.00", "10.00", "2.00"), true);
  });

  test("returns false when balance is one micro-unit short", () => {
    // 11.999999 < 10 + 2 = 12
    assert.equal(hasSufficientBalance("11.999999", "10.00", "2.00"), false);
  });

  test("returns false when balance is zero", () => {
    assert.equal(hasSufficientBalance("0", "10.00", "2.00"), false);
  });
});
