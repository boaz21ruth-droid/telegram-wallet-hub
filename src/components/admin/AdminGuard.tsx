import { Link, Navigate, Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { AdminPermission } from "@/lib/admin";

export function RequireAdmin({ permission }: { permission?: AdminPermission }) {
  const { isAuthenticated, hasPermission } = useAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <AdminAccessDenied />;
  }

  return <Outlet />;
}

function AdminAccessDenied() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-border/60 bg-card/80 px-8 py-12 text-center">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">当前角色无权访问此页面</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          当前管理员角色未开放这个模块，可以返回后台首页或联系更高权限管理员处理。
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard">返回后台首页</Link>
        </Button>
      </div>
    </div>
  );
}
