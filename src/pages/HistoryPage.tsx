import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowUpFromLine, Clock, CheckCircle2, XCircle, AlertCircle, Repeat2, Banknote } from "lucide-react";
import { useTransfers, useWithdrawals, useDeposits } from "@/hooks/use-wallet";
import { useSwapOrders } from "@/hooks/use-swap";
import { useFiatOrders } from "@/hooks/use-fiat-onramp";
import type { TransferOrder, WithdrawOrder, DepositOrder, SwapOrder, FiatOnrampOrder } from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return sameDay
    ? `今天 ${hm}`
    : d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " " + hm;
}

function fmtAmount(amount: string, assetCode: string) {
  return parseFloat(amount).toFixed(assetCode === "USDT" ? 2 : 4);
}

// ── status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  COMPLETED:          { label: "成功",   color: "text-green-400",        Icon: CheckCircle2 },
  CONFIRMED:          { label: "已确认", color: "text-green-400",        Icon: CheckCircle2 },
  PENDING:            { label: "待处理", color: "text-yellow-400",       Icon: Clock },
  PENDING_REVIEW:     { label: "审核中", color: "text-yellow-400",       Icon: Clock },
  PENDING_PAYMENT:    { label: "待付款", color: "text-yellow-400",       Icon: Clock },
  PAYMENT_SUBMITTED:  { label: "已上传", color: "text-blue-400",         Icon: AlertCircle },
  UNDER_REVIEW:       { label: "审核中", color: "text-yellow-400",       Icon: Clock },
  APPROVED:           { label: "已批准", color: "text-blue-400",         Icon: AlertCircle },
  READY_FOR_SIGNING:  { label: "待签名", color: "text-blue-400",         Icon: AlertCircle },
  SIGNED:             { label: "已签名", color: "text-blue-400",         Icon: AlertCircle },
  FAILED:             { label: "失败",   color: "text-destructive",      Icon: XCircle },
  REJECTED:           { label: "已拒绝", color: "text-destructive",      Icon: XCircle },
  EXPIRED:            { label: "已过期", color: "text-muted-foreground", Icon: XCircle },
  CANCELLED:          { label: "已取消", color: "text-muted-foreground", Icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "text-muted-foreground", Icon: Clock };
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${m.color}`}>
      <m.Icon size={12} />
      {m.label}
    </div>
  );
}

// ── sub-lists ─────────────────────────────────────────────────────────────────

function TransferList() {
  const { data, isLoading } = useTransfers();
  if (isLoading) return <Skeleton />;
  if (!data?.length) return <Empty text="暂无转账记录" />;
  return (
    <div className="space-y-3">
      {data.map((t: TransferOrder) => (
        <div key={t.id} className="p-4 rounded-xl bg-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ArrowUpRight size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                站内转账{t.note ? `·${t.note}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{formatTime(t.createdAt)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              -{fmtAmount(t.amount, t.assetCode)} {t.assetCode}
            </p>
            <StatusBadge status={t.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WithdrawList() {
  const { data, isLoading } = useWithdrawals();
  if (isLoading) return <Skeleton />;
  if (!data?.length) return <Empty text="暂无提现记录" />;
  return (
    <div className="space-y-3">
      {data.map((w: WithdrawOrder) => (
        <div key={w.id} className="p-4 rounded-xl bg-secondary/50 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <ArrowUpFromLine size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                提现 {w.assetCode}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                {w.toAddress}
              </p>
              <p className="text-xs text-muted-foreground">{formatTime(w.createdAt)}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-foreground">
              -{fmtAmount(w.totalAmount, w.assetCode)} {w.assetCode}
            </p>
            <p className="text-xs text-muted-foreground">手续费 {fmtAmount(w.fee, w.assetCode)}</p>
            <StatusBadge status={w.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DepositList() {
  const { data, isLoading } = useDeposits();
  if (isLoading) return <Skeleton />;
  if (!data?.length) return <Empty text="暂无充值记录" />;
  return (
    <div className="space-y-3">
      {data.map((d: DepositOrder) => (
        <div key={d.id} className="p-4 rounded-xl bg-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-400/10 text-green-400 flex items-center justify-center">
              <ArrowDownLeft size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">充值 {d.assetCode}</p>
              {d.txHash && (
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                  {d.txHash}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{formatTime(d.createdAt)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-green-400">
              +{fmtAmount(d.amount, d.assetCode)} {d.assetCode}
            </p>
            <StatusBadge status={d.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SwapList() {
  const { data, isLoading } = useSwapOrders();
  if (isLoading) return <Skeleton />;
  if (!data?.length) return <Empty text="暂无兑换记录" />;
  return (
    <div className="space-y-3">
      {data.map((s: SwapOrder) => {
        const isBridge = s.fromAssetCode === s.toAssetCode && s.fromNetwork !== s.toNetwork;
        const label = isBridge
          ? `${s.fromAssetCode} ${s.fromNetwork} → ${s.toNetwork}`
          : `${s.fromAssetCode} → ${s.toAssetCode}`;
        return (
          <div key={s.id} className="p-4 rounded-xl bg-secondary/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                <Repeat2 size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{formatTime(s.createdAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                -{fmtAmount(s.fromAmount, s.fromAssetCode)} {s.fromAssetCode}
              </p>
              <p className="text-xs text-green-400">
                +{fmtAmount(s.toAmount, s.toAssetCode)} {s.toAssetCode}
              </p>
              <StatusBadge status={s.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FiatList() {
  const { data, isLoading } = useFiatOrders();
  if (isLoading) return <Skeleton />;
  if (!data?.length) return <Empty text="暂无买币记录" />;
  return (
    <div className="space-y-3">
      {data.map((f: FiatOnrampOrder) => (
        <div key={f.id} className="p-4 rounded-xl bg-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
              <Banknote size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                买币 {f.assetCode}/{f.network}
              </p>
              <p className="text-xs text-muted-foreground">{formatTime(f.createdAt)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              ¥{parseFloat(f.fiatAmount).toFixed(2)}
            </p>
            <p className="text-xs text-green-400">
              +{parseFloat(f.cryptoAmount).toFixed(2)} {f.assetCode}
            </p>
            <StatusBadge status={f.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── shared tiny components ────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-12">{text}</p>;
}

// ── page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: "转账", Component: TransferList },
  { label: "提现", Component: WithdrawList },
  { label: "充值", Component: DepositList },
  { label: "兑换", Component: SwapList },
  { label: "买币", Component: FiatList },
];

const HistoryPage = () => {
  const [tab, setTab] = useState(0);
  const { Component } = TABS[tab];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-foreground mb-4">交易记录</h1>

        {/* Tab strip */}
        <div className="flex gap-2 bg-secondary/50 rounded-xl p-1">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === i
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-3">
        <Component />
      </div>
    </div>
  );
};

export default HistoryPage;
