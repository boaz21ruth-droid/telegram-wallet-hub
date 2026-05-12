import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RequireAdmin } from "@/components/admin/AdminGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminAdjustmentsPage from "@/pages/admin/AdminAdjustmentsPage";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogsPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminDepositsPage from "@/pages/admin/AdminDepositsPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminUserDetailPage from "@/pages/admin/AdminUserDetailPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminWithdrawalDetailPage from "@/pages/admin/AdminWithdrawalDetailPage";
import AdminWithdrawalsPage from "@/pages/admin/AdminWithdrawalsPage";
import AdminFiatOnrampPage from "@/pages/admin/AdminFiatOnrampPage";

const queryClient = new QueryClient();

function AdminAppRoutes() {
  const { isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-4xl">🛡️</div>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/admin-app">
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<RequireAdmin permission="dashboard:view" />}>
              <Route path="/dashboard" element={<AdminDashboardPage />} />
            </Route>
            <Route element={<RequireAdmin permission="users:view" />}>
              <Route path="/users" element={<AdminUsersPage />} />
              <Route path="/users/:userId" element={<AdminUserDetailPage />} />
            </Route>
            <Route element={<RequireAdmin permission="deposits:view" />}>
              <Route path="/deposits" element={<AdminDepositsPage />} />
            </Route>
            <Route element={<RequireAdmin permission="withdrawals:view" />}>
              <Route path="/withdrawals" element={<AdminWithdrawalsPage />} />
              <Route path="/withdrawals/:withdrawalId" element={<AdminWithdrawalDetailPage />} />
            </Route>
            <Route element={<RequireAdmin permission="fiat-onramp:view" />}>
              <Route path="/fiat-onramp" element={<AdminFiatOnrampPage />} />
            </Route>
            <Route element={<RequireAdmin permission="adjustments:view" />}>
              <Route path="/adjustments" element={<AdminAdjustmentsPage />} />
            </Route>
            <Route element={<RequireAdmin permission="audit:view" />}>
              <Route path="/audit-logs" element={<AdminAuditLogsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const AdminApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AdminAuthProvider>
        <AdminAppRoutes />
      </AdminAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default AdminApp;
