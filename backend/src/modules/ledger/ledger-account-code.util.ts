export function availableAccountCode(walletAccountId: string): string {
  return `USER_AVAILABLE:${walletAccountId}`;
}

export function frozenAccountCode(walletAccountId: string): string {
  return `USER_FROZEN:${walletAccountId}`;
}

export const PLATFORM_RESERVE = "PLATFORM_RESERVE";
export const PLATFORM_CLEARING = "PLATFORM_CLEARING";
export const PLATFORM_ADJUSTMENT = "PLATFORM_ADJUSTMENT";
