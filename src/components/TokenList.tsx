import { useWalletAccounts } from "@/hooks/use-wallet";

const ASSET_META: Record<string, Record<string, { icon: string; name: string }>> = {
  TON:  { TON:   { icon: "💎", name: "Toncoin" } },
  USDT: { TON:   { icon: "💵", name: "Tether (TON)" },
          TRC20: { icon: "💵", name: "Tether (TRC20)" } },
};

const TokenList = () => {
  const { data: accounts, isLoading } = useWalletAccounts();

  return (
    <div className="mt-6 px-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">资产</h2>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {accounts?.map((account) => {
          const meta = ASSET_META[account.assetCode]?.[account.network]
            ?? { icon: "🪙", name: `${account.assetCode} (${account.network})` };
          const available = parseFloat(account.availableBalance);
          const frozen = parseFloat(account.frozenBalance);

          return (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                  {meta.icon}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{account.assetCode}</p>
                  <p className="text-xs text-muted-foreground">{meta.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground text-sm">
                  {available.toFixed(account.assetCode === "USDT" ? 2 : 4)}
                </p>
                {frozen > 0 && (
                  <p className="text-xs text-orange-400">冻结 {frozen.toFixed(4)}</p>
                )}
                {frozen === 0 && (
                  <p className="text-xs text-muted-foreground">{account.network}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TokenList;
