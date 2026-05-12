import { parseUsdtAmountToUnits } from "./trc20-utils";

/**
 * Returns true if `balance` >= `amount` + `fee` (all as decimal USDT strings).
 */
export function hasSufficientBalance(balance: string, amount: string, fee: string): boolean {
  try {
    const balanceUnits = parseUsdtAmountToUnits(balance);
    const requiredUnits = parseUsdtAmountToUnits(amount) + parseUsdtAmountToUnits(fee);
    return balanceUnits >= requiredUnits;
  } catch {
    return false;
  }
}
