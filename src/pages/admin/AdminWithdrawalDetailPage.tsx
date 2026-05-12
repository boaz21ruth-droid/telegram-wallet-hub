import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  useAdminApproveWithdrawal,
  useAdminConfirmWithdrawal,
  useAdminFailWithdrawal,
  useAdminRejectWithdrawal,
  useAdminSignWithdrawal,
  useAdminWithdrawals,
} from "@/hooks/use-admin";
import { formatAssetAmount, formatDateTime, formatDisplayName, truncateMiddle } from "@/lib/format";

export default function AdminWithdrawalDetailPage() {
  const { withdrawalId } = useParams();
  const { hasPermission } = useAdminAuth();
  const withdrawalsQuery = useAdminWithdrawals();

  const approveMutation = useAdminApproveWithdrawal();
  const rejectMutation = useAdminRejectWithdrawal();
  const signMutation = useAdminSignWithdrawal();
  const confirmMutation = useAdminConfirmWithdrawal();
  const failMutation = useAdminFailWithdrawal();

  const [reviewNote, setReviewNote] = useState("");
  const [failureNote, setFailureNote] = useState("");
  const [txHash, setTxHash] = useState("");

  const order = (withdrawalsQuery.data ?? []).find((item) => item.id === withdrawalId);

  if (!order) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          提现订单不存在或仍在加载中。
        </CardContent>
      </Card>
    );
  }

  const runAction = async (action: () => Promise<unknown>, successText: string, clear?: () => void) => {
    try {
      await action();
      clear?.();
      toast.success(successText);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-2xl">提现处理详情</CardTitle>
            <CardDescription className="mt-2">
              {formatDisplayName(order.user)} · {order.user.telegramUserId}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge value={order.status} />
            <AdminStatusBadge value={order.reviewStatus} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <section className="rounded-3xl border border-border/60 bg-background/50 p-4">
            <h2 className="text-sm font-medium text-foreground">订单信息</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <MetaRow
                label="金额"
                value={`${formatAssetAmount(order.amount, order.assetCode)} ${order.assetCode}`}
              />
              <MetaRow
                label="冻结总额"
                value={`${formatAssetAmount(order.totalAmount, order.assetCode)} ${order.assetCode}`}
              />
              <MetaRow
                label="手续费"
                value={`${formatAssetAmount(order.fee, order.assetCode)} ${order.assetCode}`}
              />
              <MetaRow label="目标地址" value={order.toAddress} mono />
              <MetaRow label="txHash" value={order.txHash ?? "—"} mono />
              <MetaRow label="创建时间" value={formatDateTime(order.createdAt)} />
              <MetaRow label="审核时间" value={formatDateTime(order.reviewedAt)} />
              <MetaRow label="审核备注" value={order.reviewerNote ?? "—"} />
              <MetaRow label="用户备注" value={order.note ?? "—"} />
            </dl>
          </section>

          <section className="rounded-3xl border border-border/60 bg-background/50 p-4">
            <h2 className="text-sm font-medium text-foreground">账本引用</h2>
            <div className="mt-4 space-y-3 text-sm">
              <LedgerChip label="Freeze Journal" value={order.freezeJournalId} />
              <LedgerChip label="Release Journal" value={order.releaseJournalId} />
              <LedgerChip label="Confirm Journal" value={order.confirmJournalId} />
            </div>
            <div className="mt-6">
              <Button variant="outline" asChild>
                <Link to={`/users/${order.user.id}`}>查看用户详情</Link>
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">审核动作</CardTitle>
            <CardDescription>适用于 `PENDING_REVIEW` 阶段，备注会写入审计日志。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="审核备注"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!hasPermission("withdrawals:review") || order.status !== "PENDING_REVIEW" || approveMutation.isPending}
                onClick={() =>
                  void runAction(
                    () => approveMutation.mutateAsync({ id: order.id, note: reviewNote || undefined }),
                    "提现已审核通过",
                    () => setReviewNote(""),
                  )
                }
              >
                审核通过
              </Button>
              <Button
                variant="destructive"
                disabled={!hasPermission("withdrawals:review") || order.status !== "PENDING_REVIEW" || rejectMutation.isPending}
                onClick={() =>
                  void runAction(
                    () => rejectMutation.mutateAsync({ id: order.id, note: reviewNote || undefined }),
                    "提现已拒绝并回退余额",
                    () => setReviewNote(""),
                  )
                }
              >
                审核拒绝
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">执行动作</CardTitle>
            <CardDescription>适用于签名、链上确认和异常失败回退。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              placeholder="签名或广播后填写 txHash"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!hasPermission("withdrawals:sign") || order.status !== "READY_FOR_SIGNING" || !txHash || signMutation.isPending}
                onClick={() =>
                  void runAction(
                    () => signMutation.mutateAsync({ id: order.id, txHash }),
                    "提现已标记为已签名",
                    () => setTxHash(""),
                  )
                }
              >
                录入签名结果
              </Button>
              <Button
                variant="outline"
                disabled={!hasPermission("withdrawals:confirm") || order.status !== "SIGNED" || confirmMutation.isPending}
                onClick={() =>
                  void runAction(
                    () => confirmMutation.mutateAsync(order.id),
                    "提现已确认完成",
                  )
                }
              >
                链上确认
              </Button>
            </div>

            <Textarea
              value={failureNote}
              onChange={(event) => setFailureNote(event.target.value)}
              placeholder="失败原因 / 回退说明"
            />
            <Button
              variant="destructive"
              disabled={
                !hasPermission("withdrawals:fail") ||
                (order.status !== "READY_FOR_SIGNING" && order.status !== "SIGNED") ||
                !failureNote ||
                failMutation.isPending
              }
              onClick={() =>
                void runAction(
                  () => failMutation.mutateAsync({ id: order.id, note: failureNote }),
                  "提现已标记失败并回退余额",
                  () => setFailureNote(""),
                )
              }
            >
              标记失败
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "max-w-[26rem] break-all text-right font-mono text-xs text-foreground" : "text-right font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function LedgerChip({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xs text-foreground">{value ?? "—"}</p>
    </div>
  );
}
