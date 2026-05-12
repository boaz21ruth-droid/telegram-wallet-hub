import { Link, useSearchParams } from "react-router-dom";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminWithdrawals } from "@/hooks/use-admin";
import { formatAssetAmount, formatDateTime, formatDisplayName, truncateMiddle } from "@/lib/format";
import type { WithdrawStatus } from "@/lib/api";

const STATUS_TABS: Array<{ value: "ALL" | WithdrawStatus; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "READY_FOR_SIGNING", label: "待签名" },
  { value: "SIGNED", label: "已签名待确认" },
  { value: "CONFIRMED", label: "已完成" },
  { value: "FAILED", label: "失败" },
  { value: "REJECTED", label: "已拒绝" },
];

export default function AdminWithdrawalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = (searchParams.get("status") as "ALL" | WithdrawStatus | null) ?? "ALL";
  const keyword = searchParams.get("telegramUserId") ?? "";

  const withdrawalsQuery = useAdminWithdrawals(activeStatus === "ALL" ? undefined : activeStatus);

  const rows = (withdrawalsQuery.data ?? []).filter((item) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      item.user.telegramUserId.toLowerCase().includes(q) ||
      formatDisplayName(item.user).toLowerCase().includes(q) ||
      item.toAddress.toLowerCase().includes(q) ||
      (item.txHash ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="gap-4">
        <div>
          <CardTitle className="text-xl">提现工作台</CardTitle>
          <CardDescription>集中处理审核、签名、确认和失败回退。</CardDescription>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={activeStatus}
            onValueChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value === "ALL") next.delete("status");
              else next.set("status", value);
              setSearchParams(next);
            }}
          >
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-secondary/70 p-1">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl px-3 py-2">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Input
            value={keyword}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set("telegramUserId", event.target.value);
              else next.delete("telegramUserId");
              setSearchParams(next);
            }}
            placeholder="筛选 Telegram ID / 地址 / txHash"
            className="w-full lg:w-80"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>目标地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>审核状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{formatDisplayName(item.user)}</p>
                      <p className="text-xs text-muted-foreground">{item.user.telegramUserId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {formatAssetAmount(item.totalAmount, item.assetCode)} {item.assetCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        手续费 {formatAssetAmount(item.fee, item.assetCode)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <div>{truncateMiddle(item.toAddress)}</div>
                    {item.txHash && <div className="mt-1">tx: {truncateMiddle(item.txHash)}</div>}
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge value={item.status} />
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge value={item.reviewStatus} />
                  </TableCell>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/withdrawals/${item.id}`}>处理详情</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  当前筛选下没有提现订单。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
