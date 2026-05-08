import { useState } from "react";
import { Copy, Check } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDepositAddress, useSupportedAssets } from "@/hooks/use-wallet";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ReceiveSheet = ({ open, onClose }: Props) => {
  const { data: assets } = useSupportedAssets();
  const [assetCode, setAssetCode] = useState("TON");
  const [network, setNetwork] = useState("TON");
  const [copied, setCopied] = useState(false);

  const uniqueAssetCodes = [...new Set(assets?.map((a) => a.assetCode) ?? [])];
  const networkOptions = assets?.filter((a) => a.assetCode === assetCode).map((a) => a.network) ?? [];

  const selectAsset = (code: string) => {
    const nets = assets?.filter((a) => a.assetCode === code).map((a) => a.network) ?? [];
    setAssetCode(code);
    if (nets.length > 0) setNetwork(nets[0]);
  };

  const { data: depositInfo, isLoading } = useDepositAddress(assetCode, network, open);

  const handleCopy = async () => {
    if (!depositInfo?.address) return;
    await navigator.clipboard.writeText(depositInfo.address);
    setCopied(true);
    toast.success("地址已复制");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl h-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>充值 / 接收</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 pb-4">
          {/* Asset selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">选择资产</label>
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

          {/* Address display */}
          <div className="rounded-2xl bg-secondary/50 p-4 flex flex-col gap-3">
            {isLoading ? (
              <div className="h-5 rounded bg-muted animate-pulse" />
            ) : depositInfo?.address ? (
              <>
                <p className="text-xs text-muted-foreground text-center">
                  {assetCode} 充值地址（{network} 网络）
                </p>
                <div className="flex justify-center py-2">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCode value={depositInfo.address} size={160} />
                  </div>
                </div>
                <p className="text-sm font-mono text-foreground text-center break-all leading-relaxed">
                  {depositInfo.address}
                </p>
                {depositInfo.memo && (
                  <p className="text-xs text-center text-muted-foreground">
                    Memo / Tag：<span className="text-foreground font-medium">{depositInfo.memo}</span>
                  </p>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary py-2 text-sm font-medium"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "已复制" : "复制地址"}
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">暂无充值地址</p>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            仅向此地址发送 <strong>{assetCode}</strong>（{network} 网络），发送其他资产将永久丢失
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReceiveSheet;
