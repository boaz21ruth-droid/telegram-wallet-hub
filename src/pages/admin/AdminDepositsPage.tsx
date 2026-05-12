import { useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { PlusCircle, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminAssignDepositAddress, useAdminCreditDeposit, useAdminDeposits } from "@/hooks/use-admin";
import { useSupportedAssets } from "@/hooks/use-wallet";
import { formatAssetAmount, formatDateTime, formatDisplayName, truncateMiddle } from "@/lib/format";

const DEFAULT_FORM = {
  telegramUserId: "",
  assetCode: "TON",
  network: "TON",
  amount: "",
  fromAddress: "",
  txHash: "",
  note: "",
};

const DEFAULT_ADDRESS_FORM = {
  telegramUserId: "",
  assetCode: "TON",
  network: "TON",
  address: "",
  memo: "",
};

export default function AdminDepositsPage() {
  const { hasPermission } = useAdminAuth();
  const { data: assets = [] } = useSupportedAssets();
  const [searchParams] = useSearchParams();
  const presetTelegramUserId = searchParams.get("telegramUserId") ?? "";

  const depositsQuery = useAdminDeposits(100, 0);
  const creditDeposit = useAdminCreditDeposit();
  const assignAddress = useAdminAssignDepositAddress();

  const [keyword, setKeyword] = useState(presetTelegramUserId);
  const [creditOpen, setCreditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [creditForm, setCreditForm] = useState({ ...DEFAULT_FORM, telegramUserId: presetTelegramUserId });
  const [addressForm, setAddressForm] = useState({
    ...DEFAULT_ADDRESS_FORM,
    telegramUserId: presetTelegramUserId,
  });

  const deposits = (depositsQuery.data ?? []).filter((item) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      item.user.telegramUserId.toLowerCase().includes(q) ||
      formatDisplayName(item.user).toLowerCase().includes(q) ||
      (item.txHash ?? "").toLowerCase().includes(q)
    );
  });

  const syncAsset = (
    next: string,
    setter: Dispatch<SetStateAction<typeof creditForm | typeof addressForm>>,
  ) => {
    const asset = assets.find((item) => `${item.assetCode}:${item.network}` === next);
    if (!asset) return;
    setter((current) => ({
      ...current,
      assetCode: asset.assetCode,
      network: asset.network,
    }));
  };

  const onCreditSubmit = async () => {
    try {
      await creditDeposit.mutateAsync({
        telegramUserId: creditForm.telegramUserId,
        assetCode: creditForm.assetCode,
        network: creditForm.network,
        amount: creditForm.amount,
        fromAddress: creditForm.fromAddress || undefined,
        txHash: creditForm.txHash || undefined,
        note: creditForm.note || undefined,
      });
      toast.success("充值已成功入账");
      setCreditOpen(false);
      setCreditForm({ ...DEFAULT_FORM, telegramUserId: creditForm.telegramUserId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "入账失败");
    }
  };

  const onAssignSubmit = async () => {
    try {
      await assignAddress.mutateAsync({
        telegramUserId: addressForm.telegramUserId,
        assetCode: addressForm.assetCode,
        network: addressForm.network,
        address: addressForm.address,
        memo: addressForm.memo || undefined,
      });
      toast.success("充值地址已分配");
      setAssignOpen(false);
      setAddressForm({ ...DEFAULT_ADDRESS_FORM, telegramUserId: addressForm.telegramUserId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "地址分配失败");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-xl">充值管理</CardTitle>
            <CardDescription>处理手工入账、充值地址分配，以及充值记录核查。</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索用户 / txHash"
                className="w-full pl-9 sm:w-72"
              />
            </div>
            {hasPermission("deposits:credit") && (
              <Button onClick={() => setCreditOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                手工入账
              </Button>
            )}
            {hasPermission("deposits:assign_address") && (
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                分配地址
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>资产</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>txHash</TableHead>
                <TableHead>入账时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.length ? (
                deposits.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{formatDisplayName(item.user)}</p>
                        <p className="text-xs text-muted-foreground">{item.user.telegramUserId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.assetCode} / {item.network}
                    </TableCell>
                    <TableCell>
                      +{formatAssetAmount(item.amount, item.assetCode)} {item.assetCode}
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge value={item.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {truncateMiddle(item.txHash)}
                    </TableCell>
                    <TableCell>{formatDateTime(item.creditedAt ?? item.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    暂无匹配充值记录。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手工入账</DialogTitle>
            <DialogDescription>确认链上到账后再执行。txHash 建议填写以便后续去重核查。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Telegram User ID"
              value={creditForm.telegramUserId}
              onChange={(event) => setCreditForm((current) => ({ ...current, telegramUserId: event.target.value }))}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={`${creditForm.assetCode}:${creditForm.network}`}
              onChange={(event) => syncAsset(event.target.value, setCreditForm)}
            >
              {assets.map((asset) => (
                <option key={`${asset.assetCode}:${asset.network}`} value={`${asset.assetCode}:${asset.network}`}>
                  {asset.assetCode} / {asset.network}
                </option>
              ))}
            </select>
            <Input
              placeholder="金额"
              value={creditForm.amount}
              onChange={(event) => setCreditForm((current) => ({ ...current, amount: event.target.value }))}
            />
            <Input
              placeholder="来源地址（可选）"
              value={creditForm.fromAddress}
              onChange={(event) => setCreditForm((current) => ({ ...current, fromAddress: event.target.value }))}
            />
            <Input
              placeholder="txHash（可选）"
              value={creditForm.txHash}
              onChange={(event) => setCreditForm((current) => ({ ...current, txHash: event.target.value }))}
            />
            <Textarea
              placeholder="备注（可选）"
              value={creditForm.note}
              onChange={(event) => setCreditForm((current) => ({ ...current, note: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>
              取消
            </Button>
            <Button disabled={creditDeposit.isPending} onClick={() => void onCreditSubmit()}>
              确认入账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配充值地址</DialogTitle>
            <DialogDescription>会将该地址设置为当前用户该资产的钱包主地址。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Telegram User ID"
              value={addressForm.telegramUserId}
              onChange={(event) => setAddressForm((current) => ({ ...current, telegramUserId: event.target.value }))}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              value={`${addressForm.assetCode}:${addressForm.network}`}
              onChange={(event) => syncAsset(event.target.value, setAddressForm)}
            >
              {assets.map((asset) => (
                <option key={`${asset.assetCode}:${asset.network}`} value={`${asset.assetCode}:${asset.network}`}>
                  {asset.assetCode} / {asset.network}
                </option>
              ))}
            </select>
            <Input
              placeholder="充值地址"
              value={addressForm.address}
              onChange={(event) => setAddressForm((current) => ({ ...current, address: event.target.value }))}
            />
            <Input
              placeholder="Memo（可选）"
              value={addressForm.memo}
              onChange={(event) => setAddressForm((current) => ({ ...current, memo: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              取消
            </Button>
            <Button disabled={assignAddress.isPending} onClick={() => void onAssignSubmit()}>
              保存地址
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
