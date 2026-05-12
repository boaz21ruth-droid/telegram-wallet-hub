import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stakingApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useStakingProducts() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["staking", "products"],
    queryFn: stakingApi.products,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function useMyStakingOrders(limit = 20, offset = 0) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["staking", "orders", limit, offset],
    queryFn: () => stakingApi.myOrders(limit, offset),
    enabled: isAuthenticated,
  });
}

export function useStakeAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stakingApi.stake,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staking", "orders"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useRedeemStaking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => stakingApi.redeem(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staking", "orders"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
