import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminUpdateUserStatus, useAdminUsers } from "@/hooks/use-admin";
import { formatDate, formatDisplayName } from "@/lib/format";
import type { UserStatus } from "@/lib/api";

const USER_STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DISABLED"];

export default function AdminUsersPage() {
  const { hasPermission } = useAdminAuth();
  const usersQuery = useAdminUsers(100, 0);
  const updateStatus = useAdminUpdateUserStatus();

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const rows = (usersQuery.data?.data ?? []).filter((user) => {
    const q = keyword.trim().toLowerCase();
    const matchesKeyword =
      !q ||
      user.telegramUserId.toLowerCase().includes(q) ||
      (user.username ?? "").toLowerCase().includes(q) ||
      formatDisplayName(user).toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });

  const onStatusChange = async (userId: string, status: UserStatus) => {
    try {
      await updateStatus.mutateAsync({ userId, status });
      toast.success("用户状态已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle className="text-xl">用户管理</CardTitle>
          <CardDescription>用于检索用户、查看钱包账户，以及处理状态冻结/禁用。</CardDescription>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr,180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索 Telegram ID / 用户名"
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          >
            <option value="ALL">全部状态</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>钱包数</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{formatDisplayName(user)}</p>
                      <p className="text-xs text-muted-foreground">{user.telegramUserId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge value={user.role} />
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge value={user.status} />
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge value={user.kycStatus} />
                  </TableCell>
                  <TableCell>{user._count?.walletAccounts ?? "—"}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/users/${user.id}`}>详情</Link>
                      </Button>
                      {hasPermission("users:edit") &&
                        USER_STATUSES.filter((status) => status !== user.status).map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={status === "DISABLED" ? "destructive" : "secondary"}
                            disabled={updateStatus.isPending}
                            onClick={() => void onStatusChange(user.id, status)}
                          >
                            设为 {status}
                          </Button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  暂无匹配用户。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
