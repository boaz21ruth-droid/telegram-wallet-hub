import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ArrowDownUp } from "lucide-react";
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

const SwapSheet = ({ open, onClose }: Props) => {
  const { data: assets } = useSupportedAssets();
  const { data: accounts } = useWalletAccounts();
  const createSwap = useCreateSwap();

  const [fromAsset, setFromAsset] = useState("USDT");
  const [fromNetwork, setFromNetwork] = useState("TRC20");
  const [toAsset, setToAsset] = useState("TON");
  const [toNetwork, setToNetwork] = useState("TON");
  const [amount, setAmount] = useState("");
  const [countdown, setCountdown] = useState(0);

  const debouncedAmount = useDebounce(amount, 500);

  const quoteParams =
    debouncedAmount && Number(debouncedAmount) > 0
      ? { fromAssetCode: fromAsset, fromNetwork, fromAmount: debouncedAmount, toAssetCode: toAsset, toNetwork }
      : null;

  const { data: quote, isFetching } = useSwapQuote(quoteParams);

  // Countdown until quote expires
  useEffect(() => {
    if (!quote?.expiresAt) { setCountdown(0); return; }
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote?.expiresAt]);

  const fromAccount = accounts?.find(
    (a) => a.assetCode === fromAsset && a.network === fromNetwork
  );

  // Unique asset list from enabled assets
  const assetOptions = [...new Set(assets?.map((a) => `${a.assetCode}/${a.network}`) ?? [])];

  const parseAssetOption = (opt: string) => {
    const [code, net] = opt.split("/");
    return { code, net };
  };

  const handleConfirm = useCallback(async () => {
    if (!quote || !amount) return;
    const bizNo = `swap-${Date.now()}`;
    const slippage = 0.01;
    const minToAmount = (Number(quote.toAmount) * (1 - slippage)).toFixed(8);
    try {
      await createSwap.mutateAsync({
        fromAssetCode: fromAsset,
        fromNetwork,
        fromAmount: amount,
        toAssetCode: toAsset,
        toNetwork,
        minToAmount,
        bizNo,
      });
      toast.success(`兑换成功！获得约 ${Number(quote.toAmount).toFixed(4)} ${toAsset}`);
      setAmount("");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "兑换失败");
    }
  }, [quote, amount, fromAsset, fromNetwork, toAsset, toNetwork, createSwap, onClose]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>兑换</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* From */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="text-sm text-muted-foreground">支出资产</div>
            <div className="flex gap-2">
              <select
                className="bg-background border rounded-lg px-3 py-2 text-sm flex-none"
                value={`${fromAsset}/${fromNetwork}`}
                onChange={(e) => {
                  const { code, net } = parseAssetOption(e.target.value);
                  setFromAsset(code); setFromNetwork(net);
                }}
              >
                {assetOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt.replace("/", " / ")}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-lg font-semibold"
              />
            </div>
            {fromAccount && (
              <div className="text-xs text-muted-foreground">
                可用: {Number(fromAccount.availableBalance).toFixed(4)} {fromAsset}
              </div>
            )}
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center">
            <button
              className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              onClick={() => {
                setFromAsset(toAsset); setFromNetwork(toNetwork);
                setToAsset(fromAsset); setToNetwork(fromNetwork);
                setAmount("");
              }}
            >
              <ArrowDownUp size={18} />
            </button>
          </div>

          {/* To */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="text-sm text-muted-foreground">获得资产</div>
            <div className="flex gap-2 items-center">
              <select
                className="bg-background border rounded-lg px-3 py-2 text-sm flex-none"
                value={`${toAsset}/${toNetwork}`}
                onChange={(e) => {
                  const { code, net } = parseAssetOption(e.target.value);
                  setToAsset(code); setToNetwork(net);
                }}
              >
                {assetOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt.replace("/", " / ")}</option>
                ))}
              </select>
              <div className="flex-1 text-lg font-semibold text-muted-foreground pl-2">
                {isFetching ? "..." : quote ? `≈ ${Number(quote.toAmount).toFixed(4)}` : "—"}
              </div>
            </div>
          </div>

          {/* Quote details */}
          {quote && (
            <div className="text-sm space-y-1 px-1">
              <div className="flex justify-between text-muted-foreground">
                <span>汇率</span>
                <span>1 {fromAsset} ≈ {Number(quote.midRate).toFixed(4)} {toAsset}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>手续费</span>
                <span>{Number(quote.feeAmount).toFixed(4)} {toAsset}</span>
              </div>
              {countdown > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>报价有效期</span>
                  <span className={countdown < 10 ? "text-destructive" : ""}>{countdown}s</span>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full mt-2"
            disabled={!quote || !amount || createSwap.isPending || isFetching}
            onClick={handleConfirm}
          >
            {createSwap.isPending ? "兑换中..." : "确认兑换"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SwapSheet;
