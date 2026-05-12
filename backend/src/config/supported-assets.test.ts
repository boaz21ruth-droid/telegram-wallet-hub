import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { getEnabledAssets, supportedAssets } from "./supported-assets";

describe("getEnabledAssets", () => {
  const original = process.env.DISABLED_NETWORKS;

  afterEach(() => {
    if (original === undefined) delete process.env.DISABLED_NETWORKS;
    else process.env.DISABLED_NETWORKS = original;
  });

  test("defaults to disabling TON network when DISABLED_NETWORKS is unset", () => {
    delete process.env.DISABLED_NETWORKS;
    const assets = getEnabledAssets();
    assert.ok(assets.every((a) => a.network !== "TON"), "TON assets should be excluded by default");
    assert.ok(assets.some((a) => a.network === "TRC20"), "TRC20 assets should remain");
  });

  test("returns all assets when DISABLED_NETWORKS is empty string", () => {
    process.env.DISABLED_NETWORKS = "";
    const assets = getEnabledAssets();
    assert.equal(assets.length, supportedAssets.length);
  });

  test("filters out assets from a single disabled network", () => {
    process.env.DISABLED_NETWORKS = "TRC20";
    const assets = getEnabledAssets();
    assert.ok(assets.every((a) => a.network !== "TRC20"));
    assert.ok(assets.some((a) => a.network === "TON"));
  });

  test("supports multiple disabled networks as comma-separated values", () => {
    process.env.DISABLED_NETWORKS = "TON,TRC20";
    const assets = getEnabledAssets();
    assert.equal(assets.length, 0);
  });
});
