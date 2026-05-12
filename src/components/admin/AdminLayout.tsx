import { Building2, CreditCard, FileClock, LayoutDashboard, LogOut, ShieldCheck, Users, Wallet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import type { AdminPermission } from "@/lib/admin";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  permission: AdminPermission;
  Icon: typeof LayoutDashboard;
}> = [
  { to: "/dashboard", label: "仪表盘", permission: "dashboard:view", Icon: LayoutDashboard },
  { to: "/users", label: "用户管理", permission: "users:view", Icon: Users },
  { to: "/deposits", label: "充值管理", permission: "deposits:view", Icon: CreditCard },
  { to: "/withdrawals", label: "提现工作台", permission: "withdrawals:view", Icon: Wallet },
  { to: "/adjustments", label: "钱包调账", permission: "adjustments:view", Icon: Building2 },
  { to: "/audit-logs", label: "审计日志", permission: "audit:view", Icon: FileClock },
];

export default function AdminLayout() {
  const { admin, logout, hasPermission, roleLabel } = useAdminAuth();

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.1),_transparent_22%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="mb-4 rounded-3xl border border-border/60 bg-card/80 p-4 backdrop-blur lg:mb-0 lg:w-72 lg:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-primary/80">Wallet Hub</p>
              <h1 className="mt-2 text-xl font-semibold text-foreground">管理员控制台</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {admin.displayName || admin.username}
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前权限</p>
            <p className="mt-2 text-sm font-medium text-foreground">{roleLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">权限来自后端管理员账户角色。</p>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              前往用户站点
            </Button>
            <Button
              variant="ghost"
              className="px-3 text-muted-foreground hover:text-foreground"
              onClick={() => void logout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-4 flex items-center justify-between rounded-3xl border border-border/60 bg-card/70 px-5 py-4 backdrop-blur">
            <div>
              <p className="text-sm text-muted-foreground">管理端独立登录已启用</p>
              <p className="text-lg font-semibold text-foreground">统一运营与财务工作台</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Role</p>
              <p className="text-sm font-medium text-foreground">{roleLabel}</p>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
