const tokens = [
  {
    symbol: "TON",
    name: "Toncoin",
    balance: "245.80",
    value: "$1,580.20",
    change: "+3.12%",
    positive: true,
    icon: "💎",
  },
  {
    symbol: "USDT",
    name: "Tether",
    balance: "5,000.00",
    value: "$5,000.00",
    change: "+0.01%",
    positive: true,
    icon: "💵",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    balance: "0.0856",
    value: "$4,250.25",
    change: "-1.24%",
    positive: false,
    icon: "₿",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    balance: "0.952",
    value: "$1,750.00",
    change: "+0.87%",
    positive: true,
    icon: "⟠",
  },
];

const TokenList = () => {
  return (
    <div className="mt-6 px-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">代币</h2>
        <button className="text-sm text-primary hover:underline">管理</button>
      </div>
      <div className="space-y-3">
        {tokens.map((token) => (
          <div
            key={token.symbol}
            className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                {token.icon}
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{token.symbol}</p>
                <p className="text-xs text-muted-foreground">{token.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground text-sm">{token.value}</p>
              <p className={`text-xs ${token.positive ? "text-success" : "text-destructive"}`}>
                {token.change}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenList;
