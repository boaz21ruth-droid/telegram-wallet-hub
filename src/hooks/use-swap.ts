import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { swapApi, type CreateSwapBody, type GetSwapQuoteBody } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useSwapQuote(params: GetSwapQuoteBody | null) {
  return useQuery({
    queryKey: ["swap", "quote", params],
    queryFn: () => swapApi.quote(params!),
    enabled: !!params && Number(params.fromAmount) > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCreateSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSwapBody) => swapApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", "accounts"] });
      qc.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      qc.invalidateQueries({ queryKey: ["swap", "orders"] });
    },
  });
}

export function useSwapOrders(limit = 20, offset = 0) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["swap", "orders", limit, offset],
    queryFn: () => swapApi.orders(limit, offset),
    enabled: isAuthenticated,
  });
}
