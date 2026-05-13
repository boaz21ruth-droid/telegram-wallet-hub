import { useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  useAdminFiatOrders,
  useAdminFiatReviewStart,
  useAdminFiatApprove,
  useAdminFiatReject,
} from "@/hooks/use-admin";
import { formatDateTime, formatDisplayName } from "@/lib/format";
import type { AdminFiatOnrampRecord, FiatOnrampStatus } from "@/lib/api";

const STATUS_TABS: Array<{ value: "ALL" | FiatOnrampStatus; label: string }> = [
  { value: "ALL",               label: "全部" },
  { value: "PAYMENT_SUBMITTED", label: "待审核" },
  { value: "UNDER_REVIEW",      label: "审核中" },
  { value: "PENDING_PAYMENT",   label: "待付款" },
  { value: "COMPLETED",         label: "已完成" },
  { value: "REJECTED",          label: "已拒绝" },
  { value: "EXPIRED",           label: "已过期" },
];

function ReviewPanel({
  order,
  onClose,
}: {
  order: AdminFiatOnrampRecord;
  onClose: () => void;
}) {
  const { hasPermission } = useAdminAuth();
  const [note, setNote] = useState("");
  const reviewStart = useAdminFiatReviewStart();
  const approve = useAdminFiatApprove();
  const reject = useAdminFiatReject();

  const canReview = hasPermission("fiat-onramp:review");

  const run = async (action: () => Promise<unknown>, successMsg: string) => {
    try {
      await action();
      toast.success(successMsg);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>法币买币订单</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* 基本信息 */}
          <section className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">订单信息</h3>
            <Row label="订单号" value={order.id.slice(-10).toUpperCase()} mono />
            <Row label="用户" value={formatDisplayName(order.user)} />
            <Row label="Telegram ID" value={order.user.telegramUserId} mono />
            <Row label="法币金额" value={`¥${parseFloat(order.fiatAmount).toFixed(2)} ${order.fiatCurrency}`} />
            <Row label="加密金额" value={`${parseFloat(order.cryptoAmount).toFixed(4)} ${order.assetCode}/${order.network}`} />
            <Row label="汇率" value={`1 ${order.fiatCurrency} = ${parseFloat(order.exchangeRate).toFixed(6)} ${order.assetCode}`} />
            <Row label="手续费率" value={`${(parseFloat(order.feeRate) * 100).toFixed(1)}%`} />
            <Row label="支付方式" value={order.paymentMethodCode ?? "—"} />
            <Row label="收款账号" value={order.paymentAccountRef ?? "—"} mono />
            {order.paymentNote && <Row label="付款备注" value={order.paymentNote} />}
            <Row label="状态" value={<AdminStatusBadge value={order.status} />} />
            <Row label="创建时间" value={formatDateTime(order.createdAt)} />
            <Row label="过期时间" value={formatDateTime(order.expiresAt)} />
          </section>

          {/* 凭证图片 */}
          {order.paymentProofPath && (
            <section className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">付款凭证</h3>
              <a
                href={`/api/fiat-onramp/proof/${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink size={14} />
                查看原图
              </a>
              <img
                src={`/api/fiat-onramp/proof/${order.id}`}
                alt="付款凭证"
                className="max-h-64 rounded-xl border border-border/40 object-contain w-full bg-muted/30"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </section>
          )}

          {/* 审核动作 */}
          {(order.status === "PAYMENT_SUBMITTED" || order.status === "UNDER_REVIEW") && (
            <section className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">审核操作</h3>

              {order.status === "PAYMENT_SUBMITTED" && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!canReview || reviewStart.isPending}
                  onClick={() => run(() => reviewStart.mutateAsync(order.id), "已开始审核")}
                >
                  {reviewStart.isPending ? "处理中..." : "开始审核"}
                </Button>
              )}

              {order.status === "UNDER_REVIEW" && (
                <>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="审核备注（可选）"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      disabled={!canReview || approve.isPending}
                      onClick={() => run(() => approve.mutateAsync({ id: order.id, note: note || undefined }), "已审核通过，资产已入账")}
                    >
                      {approve.isPending ? "处理中..." : "通过并入账"}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={!canReview || reject.isPending}
                      onClick={() => run(() => reject.mutateAsync({ id: order.id, note: note || undefined }), "已拒绝")}
                    >
                      {reject.isPending ? "处理中..." : "拒绝"}
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* 历史审核信息 */}
          {order.reviewerNote && (
            <section className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-2 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">审核记录</h3>
              <Row label="审核时间" value={formatDateTime(order.reviewedAt)} />
              <Row label="审核备注" value={order.reviewerNote} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

export default function AdminFiatOnrampPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = (searchParams.get("status") as "ALL" | FiatOnrampStatus | null) ?? "ALL";
  const keyword = searchParams.get("q") ?? "";
  const [selected, setSelected] = useState<AdminFiatOnrampRecord | null>(null);

  const ordersQuery = useAdminFiatOrders(activeStatus === "ALL" ? undefined : activeStatus);

  const rows = (ordersQuery.data ?? []).filter((item) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      item.user.telegramUserId.toLowerCase().includes(q) ||
      formatDisplayName(item.user).toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-xl">法币买币工作台</CardTitle>
            <CardDescription>审核用户上传的付款凭证，通过后自动入账 USDT。</CardDescription>
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
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("q", e.target.value);
                else next.delete("q");
                setSearchParams(next);
              }}
              placeholder="筛选 Telegram ID / 订单号"
              className="w-full lg:w-72"
            />
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>法币金额</TableHead>
                <TableHead>加密金额</TableHead>
                <TableHead>支付方式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.status === "PAYMENT_SUBMITTED" || item.status === "UNDER_REVIEW"
                        ? "bg-yellow-500/5"
                        : ""
                    }
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{formatDisplayName(item.user)}</p>
                        <p className="text-xs text-muted-foreground">{item.user.telegramUserId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">¥{parseFloat(item.fiatAmount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{item.fiatCurrency}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-green-400">
                        +{parseFloat(item.cryptoAmount).toFixed(2)} {item.assetCode}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.network}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.paymentMethodCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge value={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={
                          item.status === "PAYMENT_SUBMITTED" || item.status === "UNDER_REVIEW"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelected(item)}
                      >
                        {item.status === "PAYMENT_SUBMITTED" ? "待审核" : "查看"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    当前筛选下没有买币订单。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected && <ReviewPanel order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
