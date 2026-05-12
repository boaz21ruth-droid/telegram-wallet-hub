import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSwapQuote, useCreateSwap } from "@/hooks/use-swap";
import { useSupportedAssets, useWalletAccounts } from "@/hooks/use-wallet";

interface Props {
  open: boolean;
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const BridgeSheet = ({ open, onClose }: Props) => {
  const { data: assets } = useSupportedAssets();
  const { data: accounts } = useWalletAccounts();
  const createSwap = useCreateSwap();

  // Bridge only supports same asset, different network
  // Default: USDT TRC20 → USDT TON
  const [assetCode, setAssetCode] = useState("USDT");
  const [fromNetwork, setFromNetwork] = useState("TRC20");
  const [toNetwork, setToNetwork] = useState("TON");
  const [amount, setAmount] = useState("");

  // Assets that appear on multiple networks (eligible for bridge)
  const bridgeableAssets = [...new Set(
    Object.entries(
      assets?.reduce<Record<string, string[]>>((acc, a) => {
        acc[a.assetCode] = acc[a.assetCode] ?? [];
        acc[a.assetCode].push(a.network);
        return acc;
      }, {}) ?? {}
    )
    .filter(([, nets]) => nets.length >= 2)
    .map(([code]) => code)
  )];

  const networksForAsset = assets?.filter((a) => a.assetCode === assetCode).map((a) => a.network) ?? [];

  const debouncedAmount = useDebounce(amount, 500);

  const quoteParams =
    debouncedAmount && Number(debouncedAmount) > 0 && fromNetwork !== toNetwork
      ? { fromAssetCode: assetCode, fromNetwork, fromAmount: debouncedAmount, toAssetCode: assetCode, toNetwork }
      : null;

  const { data: quote, isFetching } = useSwapQuote(quoteParams);

  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!quote?.expiresAt) { setCountdown(0); return; }
    const tick = () => setCountdown(Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote?.expiresAt]);

  const fromAccount = accounts?.find(
    (a) => a.assetCode === assetCode && a.network === fromNetwork
  );

  const handleConfirm = useCallback(async () => {
    if (!quote || !amount) return;
    const bizNo = `bridge-${Date.now()}`;
    const slippage = 0.005;
    const minToAmount = (Number(quote.toAmount) * (1 - slippage)).toFixed(8);
    try {
      await createSwap.mutateAsync({
        fromAssetCode: assetCode,
        fromNetwork,
        fromAmount: amount,
        toAssetCode: assetCode,
        toNetwork,
        minToAmount,
        bizNo,
      });
      toast.success(`跨链成功！${assetCode} 已从 ${fromNetwork} 跨至 ${toNetwork}`);
      setAmount("");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "跨链失败");
    }
  }, [quote, amount, assetCode, fromNetwork, toNetwork, createSwap, onClose]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>跨链桥</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Asset selector */}
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">资产</div>
            <select
              className="w-full bg-muted/50 border-0 rounded-xl px-4 py-3 text-sm"
              value={assetCode}
              onChange={(e) => { setAssetCode(e.target.value); setAmount(""); }}
            >
              {bridgeableAssets.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Network selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">从</div>
              <select
                className="w-full bg-muted/50 border-0 rounded-xl px-4 py-3 text-sm"
                value={fromNetwork}
                onChange={(e) => setFromNetwork(e.target.value)}
              >
                {networksForAsset.filter((n) => n !== toNetwork).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">到</div>
              <select
                className="w-full bg-muted/50 border-0 rounded-xl px-4 py-3 text-sm"
                value={toNetwork}
                onChange={(e) => setToNetwork(e.target.value)}
              >
                {networksForAsset.filter((n) => n !== fromNetwork).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="text-sm text-muted-foreground">金额</div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-semibold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
            />
            {fromAccount && (
              <div className="text-xs text-muted-foreground">
                可用: {Number(fromAccount.availableBalance).toFixed(4)} {assetCode}
              </div>
            )}
          </div>

          {/* Quote */}
          {quote && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">到账金额</span>
                <span className="font-semibold">≈ {Number(quote.toAmount).toFixed(4)} {assetCode}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>手续费</span>
                <span>{Number(quote.feeAmount).toFixed(4)} {assetCode}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>预计到账</span>
                <span>即时</span>
              </div>
              {countdown > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>报价有效期</span>
                  <span className={countdown < 10 ? "text-destructive" : ""}>{countdown}s</span>
                </div>
              )}
            </div>
          )}
          {isFetching && !quote && <div className="text-sm text-center text-muted-foreground">获取报价中...</div>}

          <Button
            className="w-full"
            disabled={!quote || !amount || createSwap.isPending || isFetching}
            onClick={handleConfirm}
          >
            {createSwap.isPending ? "跨链中..." : "确认跨链"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BridgeSheet;
