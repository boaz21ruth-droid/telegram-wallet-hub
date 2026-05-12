import { useState } from "react";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminAuditLogs } from "@/hooks/use-admin";
import { formatDateTime, truncateMiddle } from "@/lib/format";

const RESOURCE_TYPES = [
  { value: "all", label: "全部资源" },
  { value: "user", label: "用户" },
  { value: "wallet_account", label: "钱包账户" },
  { value: "deposit_order", label: "充值订单" },
  { value: "withdraw_order", label: "提现订单" },
];

export default function AdminAuditLogsPage() {
  const [resourceType, setResourceType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const logsQuery = useAdminAuditLogs(resourceType === "all" ? undefined : resourceType, 100, 0);

  const logs = (logsQuery.data ?? []).filter((log) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.resourceId.toLowerCase().includes(q) ||
      (log.actorUserId ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle className="text-xl">审计日志</CardTitle>
          <CardDescription>追踪管理员和系统对用户、订单、钱包的每一次关键动作。</CardDescription>
        </div>
        <div className="grid gap-3 sm:grid-cols-[180px,280px]">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
          >
            {RESOURCE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 action / resourceId / actorUserId"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>资源</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <AdminStatusBadge value={log.actorType} />
                      <div className="text-xs text-muted-foreground">{log.actorUserId ?? "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm text-foreground">{log.resourceType}</p>
                      <p className="font-mono text-xs text-muted-foreground">{truncateMiddle(log.resourceId, 10, 8)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[22rem]">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-background/70 p-3 text-xs text-muted-foreground">
                      {log.metadata ? JSON.stringify(log.metadata, null, 2) : "—"}
                    </pre>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  当前筛选下没有日志记录。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
