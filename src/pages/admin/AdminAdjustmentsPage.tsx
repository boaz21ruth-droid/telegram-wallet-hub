import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminCreateAdjustment } from "@/hooks/use-admin";
import { useSupportedAssets } from "@/hooks/use-wallet";
import { formatAssetAmount } from "@/lib/format";

const DEFAULT_FORM = {
  telegramUserId: "",
  assetCode: "TON",
  network: "TON",
  delta: "",
  note: "",
};

export default function AdminAdjustmentsPage() {
  const { data: assets = [] } = useSupportedAssets();
  const adjustmentMutation = useAdminCreateAdjustment();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState<{
    journalId: string;
    delta: string;
    assetCode: string;
    network: string;
  } | null>(null);

  const onSubmit = async () => {
    try {
      const next = await adjustmentMutation.mutateAsync({
        telegramUserId: form.telegramUserId,
        assetCode: form.assetCode,
        network: form.network,
        delta: form.delta,
        note: form.note || undefined,
      });
      setResult(next);
      setForm((current) => ({ ...DEFAULT_FORM, telegramUserId: current.telegramUserId }));
      toast.success("调账已执行");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "调账失败");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-xl">钱包调账</CardTitle>
          <CardDescription>正数增加可用余额，负数扣减可用余额。每次调账都会写入账本和审计日志。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              高风险操作
            </div>
            <p className="mt-2 text-xs text-amber-100/80">
              请先核对用户余额、币种网络和调账原因，再执行。后台不会替你做业务判断。
            </p>
          </div>

          <Input
            placeholder="Telegram User ID"
            value={form.telegramUserId}
            onChange={(event) => setForm((current) => ({ ...current, telegramUserId: event.target.value }))}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            value={`${form.assetCode}:${form.network}`}
            onChange={(event) => {
              const asset = assets.find((item) => `${item.assetCode}:${item.network}` === event.target.value);
              if (!asset) return;
              setForm((current) => ({ ...current, assetCode: asset.assetCode, network: asset.network }));
            }}
          >
            {assets.map((asset) => (
              <option key={`${asset.assetCode}:${asset.network}`} value={`${asset.assetCode}:${asset.network}`}>
                {asset.assetCode} / {asset.network}
              </option>
            ))}
          </select>
          <Input
            placeholder='调账数值，例如 "10" 或 "-5"'
            value={form.delta}
            onChange={(event) => setForm((current) => ({ ...current, delta: event.target.value }))}
          />
          <Textarea
            placeholder="调账原因 / 备注"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          />
          <Button disabled={adjustmentMutation.isPending} onClick={() => void onSubmit()}>
            执行调账
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-xl">结果回执</CardTitle>
          <CardDescription>执行成功后，保留本次账本引用，便于审计和问题追踪。</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4 rounded-3xl border border-border/60 bg-background/50 p-5">
              <ResultRow label="Journal ID" value={result.journalId} mono />
              <ResultRow
                label="Delta"
                value={`${result.delta.startsWith("-") ? "" : "+"}${formatAssetAmount(result.delta, result.assetCode)} ${result.assetCode}`}
              />
              <ResultRow label="Network" value={result.network} />
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/60 bg-background/40 px-4 py-12 text-center text-sm text-muted-foreground">
              这里会显示最新一次调账结果。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={mono ? "break-all text-right font-mono text-xs text-foreground" : "text-right font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}
