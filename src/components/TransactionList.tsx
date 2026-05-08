import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Snowflake, RefreshCw, Settings } from "lucide-react";
import { useTransactions } from "@/hooks/use-wallet";
import { useAuth } from "@/contexts/AuthContext";
import type { Transaction } from "@/lib/api";

const TYPE_META: Record<
  Transaction["type"],
  { label: string; Icon: React.ElementType; colorClass: string }
> = {
  DEPOSIT:             { label: "充值",   Icon: ArrowDownLeft, colorClass: "text-success bg-success/10" },
  TRANSFER:            { label: "转账",   Icon: ArrowUpRight,  colorClass: "text-primary bg-primary/10" },
  WITHDRAWAL_FREEZE:   { label: "提现冻结", Icon: Snowflake,    colorClass: "text-orange-400 bg-orange-400/10" },
  WITHDRAWAL_RELEASE:  { label: "提现退回", Icon: RefreshCw,   colorClass: "text-success bg-success/10" },
  WITHDRAWAL_CONFIRM:  { label: "提现完成", Icon: ArrowUpRight, colorClass: "text-destructive bg-destructive/10" },
  ADJUSTMENT:          { label: "调整",   Icon: Settings,      colorClass: "text-muted-foreground bg-muted" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return isToday
    ? `今天 ${hm}`
    : d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " " + hm;
}

const PAGE_SIZE = 20;

const TransactionList = () => {
  const [offset, setOffset] = useState(0);
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const { data: page, isLoading, isFetching } = useTransactions(PAGE_SIZE, offset);
  const { user } = useAuth();

  useEffect(() => {
    if (page === undefined) return;
    setAllTxs((prev) =>
      offset === 0 ? page : [...prev.slice(0, offset), ...page]
    );
  }, [page, offset]);

  const hasMore = (page?.length ?? 0) === PAGE_SIZE;

  return (
    <div className="mt-6 px-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">最近流水</h2>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && allTxs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">暂无交易记录</p>
      )}

      <div className="space-y-3">
        {allTxs.map((tx) => {
          const meta = TYPE_META[tx.type] ?? TYPE_META.ADJUSTMENT;
          const { Icon, label, colorClass } = meta;

          // Pick the entry that belongs to this user (DEBIT or CREDIT)
          const entry = tx.entries[0];
          const isCreditToUser = entry?.direction === "CREDIT";
          const amountSign = isCreditToUser ? "+" : "-";
          const amountColor = isCreditToUser ? "text-success" : "text-foreground";

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {tx.description ?? label}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</p>
                </div>
              </div>
              {entry && (
                <div className="text-right">
                  <p className={`font-medium text-sm ${amountColor}`}>
                    {amountSign}{parseFloat(entry.amount).toFixed(entry.assetCode === "USDT" ? 2 : 4)}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.assetCode}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={isFetching}
            className="text-sm text-primary font-medium py-2 px-6 rounded-xl border border-primary/30 disabled:opacity-40"
          >
            {isFetching ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
