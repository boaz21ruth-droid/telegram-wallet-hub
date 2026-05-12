import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminDeposits, useAdminUser, useAdminWithdrawals } from "@/hooks/use-admin";
import { useAdminKycByUser, useAdminReviewKyc } from "@/hooks/use-kyc";
import { formatAssetAmount, formatDateTime, formatDisplayName, truncateMiddle } from "@/lib/format";
import { hasAdminPermission } from "@/lib/admin";

const KYC_ID_TYPE_LABELS: Record<string, string> = {
  ID_CARD: "身份证",
  PASSPORT: "护照",
  DRIVER_LICENSE: "驾照",
};

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const { admin } = useAdminAuth();
  const userQuery = useAdminUser(userId);
  const depositsQuery = useAdminDeposits(100, 0);
  const withdrawalsQuery = useAdminWithdrawals();
  const kycQuery = useAdminKycByUser(userId);
  const reviewKycMutation = useAdminReviewKyc();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const user = userQuery.data;

  if (!user) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          用户不存在或仍在加载中。
        </CardContent>
      </Card>
    );
  }

  const deposits = (depositsQuery.data ?? []).filter((item) => item.user.id === user.id).slice(0, 5);
  const withdrawals = (withdrawalsQuery.data ?? []).filter((item) => item.user.id === user.id).slice(0, 5);
  const kyc = kycQuery.data ?? null;
  const canReviewKyc = admin ? hasAdminPermission(admin.role, "kyc:review") : false;

  const handleApprove = () => {
    if (!userId) return;
    reviewKycMutation.mutate({ userId, approved: true }, {
      onSuccess: () => toast.success("KYC 已通过"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "操作失败"),
    });
  };

  const handleReject = () => {
    if (!userId) return;
    reviewKycMutation.mutate({ userId, approved: false, note: rejectNote }, {
      onSuccess: () => { toast.success("KYC 已拒绝"); setRejectDialogOpen(false); setRejectNote(""); },
      onError: (err) => toast.error(err instanceof Error ? err.message : "操作失败"),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-2xl">{formatDisplayName(user)}</CardTitle>
            <CardDescription className="mt-2">{user.telegramUserId}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge value={user.role} />
            <AdminStatusBadge value={user.status} />
            <AdminStatusBadge value={user.kycStatus} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="rounded-3xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm text-muted-foreground">基础信息</p>
            <dl className="mt-4 space-y-3 text-sm">
              <MetaRow label="用户名" value={user.username ?? "—"} />
              <MetaRow label="注册时间" value={formatDateTime(user.createdAt)} />
              <MetaRow label="更新时间" value={formatDateTime(user.updatedAt)} />
            </dl>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">钱包账户</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/deposits?telegramUserId=${user.telegramUserId}`}>查看充值</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/withdrawals?telegramUserId=${user.telegramUserId}`}>查看提现</Link>
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {user.walletAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {account.assetCode} / {account.network}
                    </p>
                    <p className="text-xs text-muted-foreground">{account.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {formatAssetAmount(account.availableBalance, account.assetCode)} {account.assetCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      冻结 {formatAssetAmount(account.frozenBalance, account.assetCode)}
                    </p>
                    <div className="mt-2">
                      <AdminStatusBadge value={account.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">最近充值</CardTitle>
            <CardDescription>按创建时间倒序展示最近 5 笔。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deposits.length ? (
              deposits.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-foreground">
                      +{formatAssetAmount(item.amount, item.assetCode)} {item.assetCode}
                    </p>
                    <AdminStatusBadge value={item.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    txHash: {truncateMiddle(item.txHash)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="暂无充值记录。" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">最近提现</CardTitle>
            <CardDescription>按创建时间倒序展示最近 5 笔。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>金额</TableHead>
                  <TableHead>目标地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length ? (
                  withdrawals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {formatAssetAmount(item.totalAmount, item.assetCode)} {item.assetCode}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {truncateMiddle(item.toAddress)}
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge value={item.status} />
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      暂无提现记录。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">KYC 认证信息</CardTitle>
            <CardDescription>用户提交的身份认证材料。</CardDescription>
          </div>
          {canReviewKyc && kyc && user.kycStatus === "PENDING" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={reviewKycMutation.isPending}
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={reviewKycMutation.isPending}
              >
                拒绝
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {kyc ? (
            <div className="rounded-3xl border border-border/60 bg-background/50 p-4">
              <dl className="space-y-3 text-sm">
                <MetaRow label="真实姓名" value={kyc.realName} />
                <MetaRow label="证件类型" value={KYC_ID_TYPE_LABELS[kyc.idType] ?? kyc.idType} />
                <MetaRow label="证件号码" value={kyc.idNumber} />
                <MetaRow label="国家/地区" value={kyc.country} />
                <MetaRow label="出生日期" value={new Date(kyc.birthDate).toLocaleDateString("zh-CN")} />
                <MetaRow label="提交时间" value={formatDateTime(kyc.createdAt)} />
                {kyc.reviewerNote && <MetaRow label="审核备注" value={kyc.reviewerNote} />}
                {kyc.reviewedAt && <MetaRow label="审核时间" value={formatDateTime(kyc.reviewedAt)} />}
              </dl>
              <div className="mt-4 flex flex-wrap gap-4">
                <a
                  href={`/uploads/${kyc.frontImagePath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={`/uploads/${kyc.frontImagePath}`}
                    alt="证件正面"
                    className="h-32 rounded-xl border border-border/60 object-cover"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">正面</p>
                </a>
                {kyc.backImagePath && (
                  <a
                    href={`/uploads/${kyc.backImagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={`/uploads/${kyc.backImagePath}`}
                      alt="证件背面"
                      className="h-32 rounded-xl border border-border/60 object-cover"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">背面</p>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <EmptyState text="该用户尚未提交 KYC 认证。" />
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝 KYC 认证</DialogTitle>
            <DialogDescription>请填写拒绝原因（将发送给用户）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectNote">拒绝原因</Label>
            <Textarea
              id="rejectNote"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="例如：照片不清晰，请重新上传"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewKycMutation.isPending}>
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
