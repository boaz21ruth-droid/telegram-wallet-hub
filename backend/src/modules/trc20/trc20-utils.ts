export const DUST_THRESHOLD_USDT = "0.01";

export function parseUsdtAmountToUnits(amount: string): bigint {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid USDT amount: "${amount}"`);
  }
  return BigInt(Math.round(n * 1_000_000));
}

export function isAboveDustThreshold(amount: string): boolean {
  return Number(amount) >= Number(DUST_THRESHOLD_USDT);
}

export function filterDepositsByAsset<T extends { assetCode: string }>(
  deposits: T[],
  assetCode: string,
): T[] {
  return deposits.filter((d) => d.assetCode === assetCode);
}
