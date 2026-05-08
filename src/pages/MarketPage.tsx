import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface CoinPrice {
  usd: number;
  usd_24h_change: number;
  usd_market_cap: number;
}

type MarketData = Record<string, CoinPrice>;

const COINS = [
  { id: "the-open-network", symbol: "TON", name: "Toncoin", icon: "💎" },
  { id: "tether",           symbol: "USDT", name: "Tether",  icon: "💵" },
  { id: "bitcoin",          symbol: "BTC",  name: "Bitcoin", icon: "₿"  },
  { id: "ethereum",         symbol: "ETH",  name: "Ethereum", icon: "Ξ" },
];

function useMarketPrices() {
  const ids = COINS.map((c) => c.id).join(",");
  return useQuery<MarketData>({
    queryKey: ["market", "prices"],
    queryFn: async () => {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      );
      if (!res.ok) throw new Error("行情数据获取失败");
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });
}

function fmt(n: number, decimals = 2) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

const MarketPage = () => {
  const { data, isLoading, isError, refetch, isFetching } = useMarketPrices();

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground">行情</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 space-y-3">
        {isError && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            行情数据加载失败，请检查网络后刷新
          </div>
        )}

        {isLoading &&
          COINS.map((c) => (
            <div key={c.id} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />
          ))}

        {!isLoading &&
          !isError &&
          COINS.map((coin) => {
            const price = data?.[coin.id];
            const change = price?.usd_24h_change ?? 0;
            const isUp = change > 0;
            const isFlat = Math.abs(change) < 0.01;

            return (
              <div
                key={coin.id}
                className="flex items-center justify-between p-4 rounded-xl bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
                    {coin.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{coin.symbol}</p>
                    <p className="text-xs text-muted-foreground">{coin.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-foreground text-sm">
                    {price ? fmt(price.usd, coin.symbol === "BTC" ? 0 : 2) : "—"}
                  </p>
                  <div
                    className={`flex items-center justify-end gap-0.5 text-xs font-medium ${
                      isFlat
                        ? "text-muted-foreground"
                        : isUp
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {isFlat ? (
                      <Minus size={11} />
                    ) : isUp ? (
                      <TrendingUp size={11} />
                    ) : (
                      <TrendingDown size={11} />
                    )}
                    {price ? `${Math.abs(change).toFixed(2)}%` : "—"}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer note */}
      {!isLoading && !isError && (
        <p className="text-center text-xs text-muted-foreground mt-6 px-6">
          数据来源 CoinGecko · 每分钟更新
        </p>
      )}
    </div>
  );
};

export default MarketPage;
