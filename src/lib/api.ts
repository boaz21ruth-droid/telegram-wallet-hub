const BASE_URL = "/api";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (initData: string) =>
    request<{ accessToken: string; user: User }>("/auth/telegram/login", {
      method: "POST",
      body: JSON.stringify({ initData }),
    }),
  devLogin: (userId: string) =>
    request<{ accessToken: string; user: User }>("/auth/dev/login", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletApi = {
  accounts: () => request<WalletAccount[]>("/wallet/accounts"),
  assets: () => request<SupportedAsset[]>("/wallet/assets"),
  transactions: (limit = 20, offset = 0) =>
    request<Transaction[]>(`/wallet/transactions?limit=${limit}&offset=${offset}`),
  depositAddress: (assetCode: string, network: string) =>
    request<DepositAddress>(`/wallet/deposit-address?assetCode=${assetCode}&network=${network}`),
};

// ── Transfers ─────────────────────────────────────────────────────────────────
export const transfersApi = {
  create: (body: CreateTransferBody) =>
    request<TransferOrder>("/transfers", { method: "POST", body: JSON.stringify(body) }),
  list: () => request<TransferOrder[]>("/transfers/orders"),
};

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const withdrawalsApi = {
  create: (body: CreateWithdrawalBody) =>
    request<WithdrawOrder>("/withdrawals", { method: "POST", body: JSON.stringify(body) }),
  list: () => request<WithdrawOrder[]>("/withdrawals/orders"),
  cancel: (id: string) =>
    request<WithdrawOrder>(`/withdrawals/orders/${id}/cancel`, { method: "POST" }),
};

// ── Deposits ──────────────────────────────────────────────────────────────────
export const depositsApi = {
  list: (limit = 20, offset = 0) =>
    request<DepositOrder[]>(`/deposits/orders?limit=${limit}&offset=${offset}`),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  role: "USER" | "ADMIN";
  status: string;
  kycStatus: string;
  walletAccounts: WalletAccount[];
  createdAt: string;
  updatedAt: string;
}

export interface WalletAccount {
  id: string;
  userId: string;
  assetCode: string;
  network: string;
  availableBalance: string;
  frozenBalance: string;
  status: string;
}

export interface SupportedAsset {
  assetCode: string;
  network: string;
  decimals: number;
  withdrawFee: string;
}

export interface DepositAddress {
  assetCode: string;
  network: string;
  address: string | null;
  memo: string | null;
}

export interface Transaction {
  id: string;
  type: "DEPOSIT" | "TRANSFER" | "WITHDRAWAL_FREEZE" | "WITHDRAWAL_RELEASE" | "WITHDRAWAL_CONFIRM" | "ADJUSTMENT";
  referenceType: string;
  referenceId: string;
  description: string | null;
  status: string;
  createdAt: string;
  entries: TxEntry[];
}

export interface TxEntry {
  id: string;
  walletAccountId: string | null;
  assetCode: string;
  network: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  ledgerAccountCode: string;
}

export interface TransferOrder {
  id: string;
  fromUserId: string;
  toUserId: string;
  assetCode: string;
  network: string;
  amount: string;
  fee: string;
  bizNo: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface WithdrawOrder {
  id: string;
  userId: string;
  assetCode: string;
  network: string;
  toAddress: string;
  amount: string;
  fee: string;
  totalAmount: string;
  status: string;
  reviewStatus: string;
  txHash: string | null;
  createdAt: string;
}

export interface DepositOrder {
  id: string;
  userId: string;
  assetCode: string;
  network: string;
  amount: string;
  status: string;
  txHash: string | null;
  creditedAt: string | null;
  createdAt: string;
}

export interface CreateTransferBody {
  recipientTelegramUserId?: string;
  recipientAddress?: string;
  assetCode: string;
  network: string;
  amount: string;
  bizNo: string;
  note?: string;
}

export interface CreateWithdrawalBody {
  assetCode: string;
  network: string;
  amount: string;
  toAddress: string;
  note?: string;
}
