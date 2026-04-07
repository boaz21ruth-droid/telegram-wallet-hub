import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

const transactions = [
  {
    type: "send",
    icon: ArrowUpRight,
    label: "发送 TON",
    to: "EQBv...3kF",
    amount: "-50.00 TON",
    value: "-$320.50",
    time: "今天 14:30",
  },
  {
    type: "receive",
    icon: ArrowDownLeft,
    label: "接收 USDT",
    to: "EQAx...9mR",
    amount: "+200.00 USDT",
    value: "+$200.00",
    time: "今天 10:15",
  },
  {
    type: "swap",
    icon: ArrowLeftRight,
    label: "兑换 ETH → USDT",
    to: "",
    amount: "0.5 ETH",
    value: "$920.00",
    time: "昨天 18:42",
  },
  {
    type: "receive",
    icon: ArrowDownLeft,
    label: "接收 BTC",
    to: "EQCz...7pL",
    amount: "+0.012 BTC",
    value: "+$596.40",
    time: "昨天 09:20",
  },
];

const typeColors: Record<string, string> = {
  send: "text-destructive bg-destructive/10",
  receive: "text-success bg-success/10",
  swap: "text-primary bg-primary/10",
};

const TransactionList = () => {
  return (
    <div className="mt-6 px-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">最近交易</h2>
        <button className="text-sm text-primary hover:underline">查看全部</button>
      </div>
      <div className="space-y-3">
        {transactions.map((tx, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeColors[tx.type]}`}>
                <tx.icon size={18} />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{tx.label}</p>
                <p className="text-xs text-muted-foreground">{tx.time}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-medium text-sm ${tx.type === "receive" ? "text-success" : "text-foreground"}`}>
                {tx.amount}
              </p>
              <p className="text-xs text-muted-foreground">{tx.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionList;
