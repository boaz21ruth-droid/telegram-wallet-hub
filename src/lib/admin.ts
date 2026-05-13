import type { AdminPrincipal, AdminRole } from "@/lib/api";

export type AdminPermission =
  | "dashboard:view"
  | "users:view"
  | "users:edit"
  | "deposits:view"
  | "deposits:credit"
  | "deposits:assign_address"
  | "withdrawals:view"
  | "withdrawals:review"
  | "withdrawals:sign"
  | "withdrawals:confirm"
  | "withdrawals:fail"
  | "adjustments:view"
  | "adjustments:create"
  | "audit:view"
  | "kyc:review"
  | "fiat-onramp:view"
  | "fiat-onramp:review"
  | "staking:view"
  | "payment-methods:manage";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_REVIEWER: "Ops Reviewer",
  FINANCE_OPERATOR: "Finance Operator",
};

const PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    "dashboard:view",
    "users:view",
    "users:edit",
    "deposits:view",
    "deposits:credit",
    "deposits:assign_address",
    "withdrawals:view",
    "withdrawals:review",
    "withdrawals:sign",
    "withdrawals:confirm",
    "withdrawals:fail",
    "adjustments:view",
    "adjustments:create",
    "audit:view",
    "kyc:review",
    "fiat-onramp:view",
    "fiat-onramp:review",
    "staking:view",
    "payment-methods:manage",
  ],
  OPS_REVIEWER: [
    "dashboard:view",
    "users:view",
    "users:edit",
    "deposits:view",
    "deposits:assign_address",
    "withdrawals:view",
    "withdrawals:review",
    "audit:view",
    "kyc:review",
    "fiat-onramp:view",
    "fiat-onramp:review",
    "staking:view",
  ],
  FINANCE_OPERATOR: [
    "dashboard:view",
    "deposits:view",
    "deposits:credit",
    "withdrawals:view",
    "withdrawals:sign",
    "withdrawals:confirm",
    "withdrawals:fail",
    "adjustments:view",
    "adjustments:create",
    "audit:view",
    "fiat-onramp:view",
    "staking:view",
    "payment-methods:manage",
  ],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function isAdminAuthenticated(admin: AdminPrincipal | null): boolean {
  return !!admin && admin.isActive;
}
