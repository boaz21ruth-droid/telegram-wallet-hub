import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { StakingOrderStatus } from "@/lib/api";

export function useAdminStakingProducts() {
  return useQuery({
    queryKey: ["admin", "staking", "products"],
    queryFn: () => adminApi.staking.products(),
  });
}

export function useCreateStakingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.staking.createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staking", "products"] }),
  });
}

export function useUpdateStakingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; currentApy?: string; isActive?: boolean };
    }) => adminApi.staking.updateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staking", "products"] }),
  });
}

export function useAdminStakingOrders(
  params: { status?: StakingOrderStatus; limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: ["admin", "staking", "orders", params],
    queryFn: () => adminApi.staking.orders(params),
  });
}
