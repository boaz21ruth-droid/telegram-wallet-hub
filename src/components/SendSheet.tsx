import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateTransfer, useSupportedAssets, useWalletAccounts } from "@/hooks/use-wallet";

const TON_FRIENDLY = /^[A-Za-z0-9_-]{48}$/;
const TON_RAW = /^-?[01]:[a-fA-F0-9]{64}$/;
const TRC20_ADDR = /^T[A-Za-z0-9]{33}$/;

const isInternalAddressInput = (value: string, network: string) => {
  const input = value.trim();
  return network === "TRC20" ? TRC20_ADDR.test(input) : TON_FRIENDLY.test(input) || TON_RAW.test(input);
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const SendSheet = ({ open, onClose }: Props) => {
  const { data: assets } = useSupportedAssets();
  const { data: accounts } = useWalletAccounts();
  const createTransfer = useCreateTransfer();

  const [recipientId, setRecipientId] = useState("");
  const [assetCode, setAssetCode] = useState("USDT");
  const [network, setNetwork] = useState("TON");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const uniqueAssetCodes = [...new Set(assets?.map((a) => a.assetCode) ?? [])];
  const networkOptions = assets?.filter((a) => a.assetCode === assetCode).map((a) => a.network) ?? [];

  const selectAsset = (code: string) => {
    const nets = assets?.filter((a) => a.assetCode === code).map((a) => a.network) ?? [];
    setAssetCode(code);
    if (nets.length > 0) setNetwork(nets[0]);
  };

  const selectedAccount = accounts?.find(
    (a) => a.assetCode === assetCode && a.network === network
  );
  const available = selectedAccount ? parseFloat(selectedAccount.availableBalance) : 0;

  const amountNum = parseFloat(amount) || 0;
  const amountError =
    amount !== "" && (amountNum <= 0 || amountNum > available)
      ? amountNum <= 0
        ? "请输入有效金额"
        : `金额超过可用余额（${available.toFixed(assetCode === "USDT" ? 2 : 4)} ${assetCode}）`
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim() || !amount) return;

    try {
      const recipientInput = recipientId.trim();
      const isAddress = isInternalAddressInput(recipientInput, network);

      await createTransfer.mutateAsync({
        recipientTelegramUserId: isAddress ? undefined : recipientInput,
        recipientAddress: isAddress ? recipientInput : undefined,
        assetCode,
        network,
        amount,
        bizNo: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        note: note || undefined,
      });
      toast.success("转账成功");
      setRecipientId("");
      setAmount("");
      setNote("");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "转账失败");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl h-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>发送</SheetTitle>
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

          {/* Recipient */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              收款方 Telegram 用户 ID / 平台内地址
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={network === "TRC20" ? "例如：123456789 或 T..." : "例如：123456789 或 EQ..."}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              仅支持平台内部账户地址，链上地址请使用“提现”
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">金额</label>
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
                onClick={() => setAmount(available.toString())}
              >
                全部
              </button>
            </div>
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
            disabled={createTransfer.isPending || !recipientId.trim() || !amount || !!amountError}
            className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-3 text-sm disabled:opacity-40 mt-2"
          >
            {createTransfer.isPending ? "发送中…" : "确认发送"}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SendSheet;
