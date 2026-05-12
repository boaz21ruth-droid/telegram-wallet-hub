import { Activity, AlertTriangle, BadgeDollarSign, Clock3, FileClock } from "lucide-react";
import { Link } from "react-router-dom";

import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuditLogs, useAdminStats } from "@/hooks/use-admin";
import { formatDateTime } from "@/lib/format";

export default function AdminDashboardPage() {
  const statsQuery = useAdminStats();
  const auditsQuery = useAdminAuditLogs(undefined, 12, 0);

  const stats = statsQuery.data;
  const audits = auditsQuery.data ?? [];

  const pendingReviewCount = stats?.pendingReviewCount ?? 0;
  const readyToSignCount = stats?.readyToSignCount ?? 0;
  const todayDepositsCount = stats?.todayDepositsCount ?? 0;
  const failedWithdrawalsCount = stats?.failedWithdrawalsCount ?? 0;
  const todayAuditLogsCount = stats?.todayAuditLogsCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard title="待审核提现" value={pendingReviewCount} hint="需要运营审核放行" Icon={Clock3} />
        <AdminMetricCard title="待签名提现" value={readyToSignCount} hint="财务可以继续广播" Icon={BadgeDollarSign} />
        <AdminMetricCard title="今日充值入账" value={todayDepositsCount} hint="按创建时间统计" Icon={Activity} />
        <AdminMetricCard title="失败提现" value={failedWithdrawalsCount} hint="需要复盘和用户反馈" Icon={AlertTriangle} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">待处理工作流</CardTitle>
              <CardDescription>优先处理会影响资金流转的事项。</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link to="/withdrawals">进入提现工作台</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <QuickActionCard
              title="提现审核"
              description="查看大额提现和审核备注"
              href="/withdrawals?status=PENDING_REVIEW"
              count={pendingReviewCount}
            />
            <QuickActionCard
              title="手工入账"
              description="处理已确认到账但未入账的充值"
              href="/deposits"
              count={todayDepositsCount}
            />
            <QuickActionCard
              title="审计追踪"
              description="复核最近的资金操作和异常"
              href="/audit-logs"
              count={todayAuditLogsCount}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileClock className="h-5 w-5 text-primary" />
              最近操作
            </CardTitle>
            <CardDescription>审计日志的最新 12 条记录。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {audits.length ? (
              audits.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge value={log.actorType} />
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {log.resourceType} · {log.resourceId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="暂无审计日志。" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  count,
}: {
  title: string;
  description: string;
  href: string;
  count: number;
}) {
  return (
    <Link
      to={href}
      className="rounded-3xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-secondary/60"
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{count}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
