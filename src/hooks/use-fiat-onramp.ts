import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fiatOnrampApi, type CreateFiatOrderBody } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useFiatQuote(fiatCurrency: string, fiatAmount: string, enabled = true) {
  return useQuery({
    queryKey: ["fiat", "quote", fiatCurrency, fiatAmount],
    queryFn: () => fiatOnrampApi.quote(fiatCurrency, fiatAmount),
    enabled: enabled && !!fiatAmount && Number(fiatAmount) > 0,
    staleTime: 30_000,
  });
}

export function useFiatPaymentMethods() {
  return useQuery({
    queryKey: ["fiat", "payment-methods"],
    queryFn: fiatOnrampApi.paymentMethods,
    staleTime: 5 * 60_000,
  });
}

export function useCreateFiatOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFiatOrderBody) => fiatOnrampApi.createOrder(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiat", "orders"] }),
  });
}

export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, formData }: { orderId: string; formData: FormData }) =>
      fiatOnrampApi.submitProof(orderId, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiat", "orders"] }),
  });
}

export function useCancelFiatOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => fiatOnrampApi.cancelOrder(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiat", "orders"] }),
  });
}

export function useFiatOrders(limit = 20, offset = 0) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["fiat", "orders", limit, offset],
    queryFn: () => fiatOnrampApi.orders(limit, offset),
    enabled: isAuthenticated,
  });
}
