import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi, kycApi } from "@/lib/api";

export function useMyKyc() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["kyc", "my"],
    queryFn: () => kycApi.get(),
    enabled: isAuthenticated,
  });
}

export function useSubmitKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => kycApi.submit(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc", "my"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useAdminKycList(limit = 20, offset = 0) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "kyc", limit, offset],
    queryFn: () => adminApi.kyc.list(limit, offset),
    enabled: isAuthenticated,
  });
}

export function useAdminKycByUser(userId?: string) {
  const { isAuthenticated } = useAdminAuth();
  return useQuery({
    queryKey: ["admin", "kyc", "user", userId],
    queryFn: () => adminApi.kyc.getByUser(userId!),
    enabled: isAuthenticated && !!userId,
  });
}

export function useAdminReviewKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, approved, note }: { userId: string; approved: boolean; note?: string }) =>
      adminApi.kyc.review(userId, { approved, note }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "kyc", "user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "kyc"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });
}
