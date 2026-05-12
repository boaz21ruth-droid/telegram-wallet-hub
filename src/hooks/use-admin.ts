import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  adminApi,
  type AssignDepositAddressBody,
  type CreateAdjustmentBody,
  type CreditDepositBody,
  type FiatOnrampStatus,
  type UserStatus,
  type WithdrawStatus,
} from "@/lib/api";

export function useAdminStats() {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.wallet.stats(),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
}

export function useAdminUsers(limit = 100, offset = 0) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "users", limit, offset],
    queryFn: () => adminApi.users.list(limit, offset),
    enabled: isAuthenticated,
  });
}

export function useAdminUser(userId?: string) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => adminApi.users.get(userId!),
    enabled: isAuthenticated && !!userId,
  });
}

export function useAdminDeposits(limit = 100, offset = 0) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "deposits", limit, offset],
    queryFn: () => adminApi.deposits.list(limit, offset),
    enabled: isAuthenticated,
  });
}

export function useAdminWithdrawals(status?: WithdrawStatus) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "withdrawals", status ?? "all"],
    queryFn: () => adminApi.withdrawals.list(status),
    enabled: isAuthenticated,
  });
}

export function useAdminAuditLogs(resourceType?: string, limit = 100, offset = 0) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "audit-logs", resourceType ?? "all", limit, offset],
    queryFn: () => adminApi.wallet.auditLogs({ resourceType, limit, offset }),
    enabled: isAuthenticated,
  });
}

export function useAdminUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      adminApi.users.updateStatus(userId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminCreditDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreditDepositBody) => adminApi.deposits.credit(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "deposits"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminAssignDepositAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignDepositAddressBody) => adminApi.deposits.assignAddress(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminApproveWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.withdrawals.approve(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminRejectWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.withdrawals.reject(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminSignWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, txHash }: { id: string; txHash: string }) => adminApi.withdrawals.sign(id, txHash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminConfirmWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.withdrawals.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminFailWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.withdrawals.fail(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdjustmentBody) => adminApi.wallet.createAdjustment(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}

export function useAdminFiatOrders(status?: FiatOnrampStatus | "ALL") {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "fiat-onramp", status ?? "all"],
    queryFn: () => adminApi.fiatOnramp.orders(status),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
}

export function useAdminFiatReviewStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.fiatOnramp.reviewStart(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "fiat-onramp"] }),
  });
}

export function useAdminFiatApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.fiatOnramp.approve(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "fiat-onramp"] }),
  });
}

export function useAdminFiatReject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.fiatOnramp.reject(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "fiat-onramp"] }),
  });
}
