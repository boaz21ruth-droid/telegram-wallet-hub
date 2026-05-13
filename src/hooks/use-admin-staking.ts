import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/api";
import type { StakingOrderStatus } from "@/lib/api";

export function useAdminStakingProducts() {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "staking", "products"],
    queryFn: () => adminApi.staking.products(),
    enabled: isAuthenticated,
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
      body: Parameters<typeof adminApi.staking.updateProduct>[1];
    }) => adminApi.staking.updateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staking", "products"] }),
  });
}

export function useAdminStakingOrders(
  params: { status?: StakingOrderStatus; limit?: number; offset?: number } = {},
) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "staking", "orders", params],
    queryFn: () => adminApi.staking.orders(params),
    enabled: isAuthenticated,
  });
}
