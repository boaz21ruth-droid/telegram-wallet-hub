import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";

export function useAdminPaymentMethods() {
  return useQuery({
    queryKey: ["admin", "payment-methods"],
    queryFn: () => adminApi.fiatOnramp.paymentMethods(),
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.fiatOnramp.createPaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payment-methods"] }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminApi.fiatOnramp.updatePaymentMethod>[1] }) =>
      adminApi.fiatOnramp.updatePaymentMethod(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payment-methods"] }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.fiatOnramp.deletePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payment-methods"] }),
  });
}
