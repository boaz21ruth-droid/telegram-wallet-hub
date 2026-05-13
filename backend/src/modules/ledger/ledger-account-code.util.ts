export function availableAccountCode(walletAccountId: string): string {
  return `USER_AVAILABLE:${walletAccountId}`;
}

export function frozenAccountCode(walletAccountId: string): string {
  return `USER_FROZEN:${walletAccountId}`;
}

export const PLATFORM_RESERVE = "PLATFORM_RESERVE";
export const PLATFORM_CLEARING = "PLATFORM_CLEARING";
export const PLATFORM_ADJUSTMENT = "PLATFORM_ADJUSTMENT";
export const PLATFORM_SWAP_FEE = "PLATFORM_SWAP_FEE";
export const PLATFORM_BRIDGE_FEE = "PLATFORM_BRIDGE_FEE";
export const PLATFORM_FIAT_FEE = "PLATFORM_FIAT_FEE";
export const PLATFORM_YIELD_POOL = "PLATFORM_YIELD_POOL";
export const PLATFORM_STAKING_FEE = "PLATFORM_STAKING_FEE";

export function stakedAccountCode(walletAccountId: string): string {
  return `USER_STAKED:${walletAccountId}`;
}
