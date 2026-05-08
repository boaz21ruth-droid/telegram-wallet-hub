import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateWithdrawal, useSupportedAssets, useWalletAccounts } from "@/hooks/use-wallet";

const TON_FRIENDLY = /^[A-Za-z0-9_-]{48}$/;
const TON_RAW = /^-?[01]:[a-fA-F0-9]{64}$/;
const TRC20_ADDR = /^T[A-Za-z0-9]{33}$/;
const isValidAddress = (addr: string, net: string) =>
  net === "TRC20" ? TRC20_ADDR.test(addr) : TON_FRIENDLY.test(addr) || TON_RAW.test(addr);

interface Props {
  open: boolean;
  onClose: () => void;
  initialAddress?: string;
}

const WithdrawSheet = ({ open, onClose, initialAddress }: Props) => {
  const { data: assets } = useSupportedAssets();
  const { data: accounts } = useWalletAccounts();
  const createWithdrawal = useCreateWithdrawal();

  const [assetCode, setAssetCode] = useState("TON");
  const [network, setNetwork] = useState("TON");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (initialAddress) setToAddress(initialAddress);
  }, [initialAddress]);

  const uniqueAssetCodes = [...new Set(assets?.map((a) => a.assetCode) ?? [])];
  const networkOptions = assets?.filter((a) => a.assetCode === assetCode).map((a) => a.network) ?? [];

  const selectAsset = (code: string) => {
    const nets = assets?.filter((a) => a.assetCode === code).map((a) => a.network) ?? [];
    setAssetCode(code);
    if (nets.length > 0) setNetwork(nets[0]);
  };

  const selectedAsset = assets?.find((a) => a.assetCode === assetCode && a.network === network);
  const selectedAccount = accounts?.find(
    (a) => a.assetCode === assetCode && a.network === network
  );
  const available = selectedAccount ? parseFloat(selectedAccount.availableBalance) : 0;
  const fee = selectedAsset ? parseFloat(selectedAsset.withdrawFee) : 0;
  const total = amount ? parseFloat(amount) + fee : 0;

  const addressError =
    toAddress && !isValidAddress(toAddress.trim(), network)
      ? network === "TRC20" ? "无效的 TRC20 地址格式" : "无效的 TON 地址格式"
      : null;
  const amountNum = parseFloat(amount) || 0;
  const amountError =
    amount !== "" && (amountNum <= 0 || amountNum + fee > available)
      ? amountNum <= 0
        ? "请输入有效金额"
        : `金额超过可用余额（含手续费共需 ${(amountNum + fee).toFixed(6)} ${assetCode}）`
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAddress.trim() || !amount) return;

    try {
      await createWithdrawal.mutateAsync({
        assetCode,
        network,
        amount,
        toAddress: toAddress.trim(),
        note: note || undefined,
      });
      toast.success("提现申请已提交");
      setToAddress("");
      setAmount("");
      setNote("");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "提现失败");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl h-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>提现到链上</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-4">
          {/* Asset selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">资产</label>
            <div className="flex gap-2">
              {uniqueAssetCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => selectAsset(code)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    assetCode === code
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              可用：{available.toFixed(assetCode === "USDT" ? 2 : 4)} {assetCode}
              {selectedAsset && (
                <span className="ml-2">手续费：{selectedAsset.withdrawFee} {assetCode}</span>
              )}
            </p>
          </div>

          {/* Network sub-selector */}
          {networkOptions.length > 1 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">网络</label>
              <div className="flex gap-2">
                {networkOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNetwork(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      network === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">目标地址</label>
            <input
              type="text"
              className={`w-full rounded-xl border ${addressError ? "border-destructive" : "border-border"} bg-secondary/50 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              placeholder={network === "TRC20" ? "T..." : "EQD..."}
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              required
            />
          </div>

          {addressError && (
            <p className="text-xs text-destructive -mt-3">{addressError}</p>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">提现金额</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                className={`w-full rounded-xl border ${amountError ? "border-destructive" : "border-border"} bg-secondary/50 px-4 py-3 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium"
                onClick={() =>
                  setAmount(Math.max(0, available - fee).toFixed(6).replace(/\.?0+$/, ""))
                }
              >
                全部
              </button>
            </div>
            {amount && !amountError && (
              <p className="text-xs text-muted-foreground mt-1">
                实际扣款：{total.toFixed(6)} {assetCode}（含手续费 {fee} {assetCode}）
              </p>
            )}
            {amountError && (
              <p className="text-xs text-destructive mt-1">{amountError}</p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">备注（可选）</label>
            <input
              type="text"
              maxLength={255}
              className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="备注信息"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={createWithdrawal.isPending || !toAddress.trim() || !!addressError || !amount || !!amountError}
            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-3 text-sm disabled:opacity-40 mt-2"
          >
            {createWithdrawal.isPending ? "提交中…" : "确认提现"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default WithdrawSheet;
