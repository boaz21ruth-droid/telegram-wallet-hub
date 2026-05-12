import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  depositsApi,
  transfersApi,
  walletApi,
  withdrawalsApi,
  type CreateTransferBody,
  type CreateWithdrawalBody,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useWalletAccounts() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["wallet", "accounts"],
    queryFn: walletApi.accounts,
    enabled: isAuthenticated,
  });
}

export function useSupportedAssets() {
  return useQuery({
    queryKey: ["wallet", "assets"],
    queryFn: walletApi.assets,
  });
}

export function useTransactions(limit = 20, offset = 0) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["wallet", "transactions", limit, offset],
    queryFn: () => walletApi.transactions(limit, offset),
    enabled: isAuthenticated,
    placeholderData: (prev) => prev,
  });
}

export function useDepositAddress(assetCode: string, network: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["wallet", "deposit-address", assetCode, network],
    queryFn: () => walletApi.depositAddress(assetCode, network),
    enabled: isAuthenticated && enabled && !!assetCode && !!network,
  });
}

export function useTransfers() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["transfers"],
    queryFn: transfersApi.list,
    enabled: isAuthenticated,
  });
}

export function useWithdrawals() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["withdrawals"],
    queryFn: withdrawalsApi.list,
    enabled: isAuthenticated,
  });
}

export function useDeposits() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["deposits"],
    queryFn: () => depositsApi.list(),
    enabled: isAuthenticated,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransferBody) => transfersApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", "accounts"] });
      qc.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useCreateWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWithdrawalBody) => withdrawalsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", "accounts"] });
      qc.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
  });
}
