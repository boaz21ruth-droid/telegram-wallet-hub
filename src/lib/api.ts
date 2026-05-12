const BASE_URL = "/api";
const USER_TOKEN_KEY = "access_token";
const ADMIN_TOKEN_KEY = "admin_access_token";

function getStoredToken(key: string): string | null {
  return localStorage.getItem(key);
}

function setStoredToken(key: string, token: string) {
  localStorage.setItem(key, token);
}

function clearStoredToken(key: string) {
  localStorage.removeItem(key);
}

export function setUserToken(token: string) {
  setStoredToken(USER_TOKEN_KEY, token);
}

export function clearUserToken() {
  clearStoredToken(USER_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  setStoredToken(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  clearStoredToken(ADMIN_TOKEN_KEY);
}

export function hasUserToken() {
  return !!getStoredToken(USER_TOKEN_KEY);
}

export function hasAdminToken() {
  return !!getStoredToken(ADMIN_TOKEN_KEY);
}

type RequestOptions = {
  tokenKey?: string;
  onUnauthorized?: () => void;
};

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const token = options.tokenKey ? getStoredToken(options.tokenKey) : null;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    options.onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const userRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, init, {
    tokenKey: USER_TOKEN_KEY,
    onUnauthorized: () => {
      clearUserToken();
      window.location.reload();
    },
  });

const adminRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, init, {
    tokenKey: ADMIN_TOKEN_KEY,
    onUnauthorized: () => {
      clearAdminToken();
      window.location.reload();
    },
  });

const publicRequest = <T>(path: string, init?: RequestInit) => request<T>(path, init);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (initData: string) =>
    publicRequest<{ accessToken: string; user: User }>("/auth/telegram/login", {
      method: "POST",
      body: JSON.stringify({ initData }),
    }),
  devLogin: (userId: string) =>
    publicRequest<{ accessToken: string; user: User }>("/auth/dev/login", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  me: () => userRequest<User>("/auth/me"),
  logout: () => userRequest<{ success: boolean }>("/auth/logout", { method: "POST" }),
};

export const adminAuthApi = {
  login: (body: AdminLoginBody) =>
    publicRequest<{ accessToken: string; admin: AdminPrincipal }>("/admin-auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => adminRequest<AdminPrincipal>("/admin-auth/me"),
  logout: () => adminRequest<{ success: boolean }>("/admin-auth/logout", { method: "POST" }),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletApi = {
  accounts: () => userRequest<WalletAccount[]>("/wallet/accounts"),
  assets: () => publicRequest<SupportedAsset[]>("/wallet/assets"),
  transactions: (limit = 20, offset = 0) =>
    userRequest<Transaction[]>(`/wallet/transactions?limit=${limit}&offset=${offset}`),
  depositAddress: (assetCode: string, network: string) =>
    userRequest<DepositAddress>(`/wallet/deposit-address?assetCode=${assetCode}&network=${network}`),
};

// ── Transfers ─────────────────────────────────────────────────────────────────
export const transfersApi = {
  create: (body: CreateTransferBody) =>
    userRequest<TransferOrder>("/transfers", { method: "POST", body: JSON.stringify(body) }),
  list: () => userRequest<TransferOrder[]>("/transfers/orders"),
};

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const withdrawalsApi = {
  create: (body: CreateWithdrawalBody) =>
    userRequest<WithdrawOrder>("/withdrawals", { method: "POST", body: JSON.stringify(body) }),
  list: () => userRequest<WithdrawOrder[]>("/withdrawals/orders"),
  cancel: (id: string) =>
    userRequest<WithdrawOrder>(`/withdrawals/orders/${id}/cancel`, { method: "POST" }),
};

// ── Deposits ──────────────────────────────────────────────────────────────────
export const depositsApi = {
  list: (limit = 20, offset = 0) =>
    userRequest<DepositOrder[]>(`/deposits/orders?limit=${limit}&offset=${offset}`),
};

// ── KYC ───────────────────────────────────────────────────────────────────────
export const kycApi = {
  submit: (formData: FormData) =>
    userRequest<KycApplication>("/kyc/submit", { method: "POST", body: formData }),
  get: () => userRequest<KycApplication | null>("/kyc"),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  users: {
    list: (limit = 20, offset = 0) =>
      adminRequest<PaginatedResponse<AdminUserSummary>>(`/admin/users?limit=${limit}&offset=${offset}`),
    get: (id: string) => adminRequest<AdminUserDetail>(`/admin/users/${id}`),
    updateStatus: (id: string, status: UserStatus) =>
      adminRequest<AdminUserDetail>(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },
  deposits: {
    list: (limit = 20, offset = 0) =>
      adminRequest<AdminDepositRecord[]>(`/admin/deposits?limit=${limit}&offset=${offset}`),
    credit: (body: CreditDepositBody) =>
      adminRequest<AdminDepositRecord>("/admin/deposits/credit", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    assignAddress: (body: AssignDepositAddressBody) =>
      adminRequest<WalletAddress>("/admin/deposits/addresses", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  withdrawals: {
    list: (status?: WithdrawStatus) =>
      adminRequest<AdminWithdrawalRecord[]>(status ? `/admin/withdrawals?status=${status}` : "/admin/withdrawals"),
    approve: (id: string, note?: string) =>
      adminRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    reject: (id: string, note?: string) =>
      adminRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    sign: (id: string, txHash: string) =>
      adminRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/sign`, {
        method: "POST",
        body: JSON.stringify({ txHash }),
      }),
    confirm: (id: string) =>
      adminRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/confirm`, {
        method: "POST",
      }),
    fail: (id: string, note?: string) =>
      adminRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/fail`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
  },
  kyc: {
    list: (limit = 20, offset = 0) =>
      adminRequest<AdminKycRecord[]>(`/admin/kyc?limit=${limit}&offset=${offset}`),
    getByUser: (userId: string) =>
      adminRequest<AdminKycRecord | null>(`/admin/kyc/${userId}`),
    review: (userId: string, body: { approved: boolean; note?: string }) =>
      adminRequest<AdminKycRecord>(`/admin/kyc/${userId}/review`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  wallet: {
    stats: () => adminRequest<AdminDashboardStats>("/admin/wallet/stats"),
    createAdjustment: (body: CreateAdjustmentBody) =>
      adminRequest<AdjustmentResult>("/admin/wallet/adjustments", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    auditLogs: (params: { limit?: number; offset?: number; resourceType?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.limit) search.set("limit", String(params.limit));
      if (params.offset) search.set("offset", String(params.offset));
      if (params.resourceType) search.set("resourceType", params.resourceType);
      const query = search.toString();
      return adminRequest<AuditLogRecord[]>(`/admin/wallet/audit-logs${query ? `?${query}` : ""}`);
    },
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type WalletAccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";
export type DepositStatus = "PENDING" | "CONFIRMED" | "FAILED";
export type ReviewStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type WithdrawStatus =
  | "PENDING_REVIEW"
  | "READY_FOR_SIGNING"
  | "REJECTED"
  | "CANCELED"
  | "SIGNED"
  | "CONFIRMED"
  | "FAILED";
export type AuditActorType = "USER" | "ADMIN" | "SYSTEM";
export type JournalType =
  | "DEPOSIT"
  | "TRANSFER"
  | "WITHDRAWAL_FREEZE"
  | "WITHDRAWAL_RELEASE"
  | "WITHDRAWAL_CONFIRM"
  | "ADJUSTMENT";
export type AdminRole = "SUPER_ADMIN" | "OPS_REVIEWER" | "FINANCE_OPERATOR";

export interface User {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  walletAccounts: WalletAccount[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminPrincipal {
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
  isActive: boolean;
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
  status: WalletAccountStatus;
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
  type: JournalType;
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
  status: WithdrawStatus;
  reviewStatus: ReviewStatus;
  txHash: string | null;
  createdAt: string;
}

export interface DepositOrder {
  id: string;
  userId: string;
  assetCode: string;
  network: string;
  amount: string;
  status: DepositStatus;
  txHash: string | null;
  creditedAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface AdminUserSummary {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    walletAccounts: number;
  };
}

export interface AdminUserDetail extends AdminUserSummary {
  walletAccounts: WalletAccount[];
}

export interface AdminDepositRecord extends DepositOrder {
  fromAddress?: string | null;
  note?: string | null;
  journalId?: string | null;
  updatedAt?: string;
  user: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface AdminWithdrawalRecord extends WithdrawOrder {
  note: string | null;
  requiresManualReview?: boolean;
  reviewerId?: string | null;
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  freezeJournalId?: string | null;
  releaseJournalId?: string | null;
  confirmJournalId?: string | null;
  updatedAt?: string;
  user: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface WalletAddress {
  id: string;
  walletAccountId: string;
  address: string;
  memo: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface AdjustmentResult {
  journalId: string;
  delta: string;
  assetCode: string;
  network: string;
}

export interface AuditLogRecord {
  id: string;
  actorType: AuditActorType;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
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

export interface CreditDepositBody {
  telegramUserId: string;
  assetCode: string;
  network: string;
  amount: string;
  fromAddress?: string;
  txHash?: string;
  note?: string;
}

export interface AssignDepositAddressBody {
  telegramUserId: string;
  assetCode: string;
  network: string;
  address: string;
  memo?: string;
}

export interface CreateAdjustmentBody {
  telegramUserId: string;
  assetCode: string;
  network: string;
  delta: string;
  note?: string;
}

export interface AdminLoginBody {
  username: string;
  password: string;
}

export interface AdminDashboardStats {
  pendingReviewCount: number;
  readyToSignCount: number;
  failedWithdrawalsCount: number;
  todayDepositsCount: number;
  todayAuditLogsCount: number;
}

export type KycIdType = "ID_CARD" | "PASSPORT" | "DRIVER_LICENSE";

export interface KycApplication {
  id: string;
  userId: string;
  realName: string;
  idType: KycIdType;
  idNumber: string;
  country: string;
  birthDate: string;
  frontImagePath: string;
  backImagePath: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminKycRecord extends KycApplication {
  user: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}
