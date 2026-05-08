import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useWalletAccounts } from "@/hooks/use-wallet";

const BalanceCard = () => {
  const [visible, setVisible] = useState(true);
  const { data: accounts, isLoading } = useWalletAccounts();

  // Total USDT (stable, = USD)
  const usdtTotal = accounts
    ?.filter((a) => a.assetCode === "USDT")
    .reduce((sum, a) => sum + parseFloat(a.availableBalance), 0) ?? 0;

  // Total TON
  const tonTotal = accounts
    ?.filter((a) => a.assetCode === "TON")
    .reduce((sum, a) => sum + parseFloat(a.availableBalance), 0) ?? 0;

  return (
    <div className="mx-6 mt-4 p-6 rounded-2xl glass-card relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted-foreground">USDT 余额</p>
          <button
            onClick={() => setVisible(!visible)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {isLoading ? (
          <div className="h-10 w-40 rounded-lg bg-muted animate-pulse mb-1" />
        ) : (
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-1">
            {visible ? `$${usdtTotal.toFixed(2)}` : "••••••"}
          </h1>
        )}

        {isLoading ? (
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        ) : (
          <p className="text-sm text-muted-foreground">
            {visible ? `${tonTotal.toFixed(4)} TON` : "•••• TON"}
          </p>
        )}
      </div>
    </div>
  );
};

export default BalanceCard;
