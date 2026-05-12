import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFiatQuote, useFiatPaymentMethods, useCreateFiatOrder, useSubmitPaymentProof } from "@/hooks/use-fiat-onramp";
import type { FiatOnrampOrder, FiatPaymentMethod } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "quote" | "method" | "proof" | "done";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const FiatOnrampSheet = ({ open, onClose }: Props) => {
  const [step, setStep] = useState<Step>("quote");
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<FiatPaymentMethod | null>(null);
  const [order, setOrder] = useState<FiatOnrampOrder | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const debouncedAmount = useDebounce(fiatAmount, 600);
  const { data: quote } = useFiatQuote("CNY", debouncedAmount);
  const { data: paymentMethods } = useFiatPaymentMethods();
  const createOrder = useCreateFiatOrder();
  const submitProof = useSubmitPaymentProof();

  const reset = () => {
    setStep("quote"); setFiatAmount(""); setSelectedMethod(null);
    setOrder(null); setProofFile(null); setPaymentNote("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleNext = async () => {
    if (step === "quote") {
      setStep("method");
    } else if (step === "method") {
      if (!selectedMethod) return;
      try {
        const created = await createOrder.mutateAsync({
          fiatCurrency: "CNY",
          fiatAmount,
          assetCode: "USDT",
          network: "TRC20",
          paymentMethodCode: selectedMethod.code,
        });
        setOrder(created);
        setStep("proof");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "创建订单失败");
      }
    } else if (step === "proof") {
      if (!order || !proofFile) { toast.error("请上传付款截图"); return; }
      const fd = new FormData();
      fd.append("proof", proofFile);
      if (paymentNote) fd.append("paymentNote", paymentNote);
      try {
        await submitProof.mutateAsync({ orderId: order.id, formData: fd });
        setStep("done");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "提交凭证失败");
      }
    }
  };

  const totalPages = 4;
  const pageIdx = { quote: 1, method: 2, proof: 3, done: 4 }[step];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            买币 {step !== "done" && (
              <span className="text-sm font-normal text-muted-foreground">
                {pageIdx}/{totalPages - 1}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Step 1: Amount + quote */}
        {step === "quote" && (
          <div className="mt-6 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="text-sm text-muted-foreground">支付金额</div>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground font-medium">CNY</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className="flex-1 text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 p-0"
                />
              </div>
              <div className="text-sm text-muted-foreground">目标资产: USDT / TRC20</div>
            </div>

            {quote && Number(fiatAmount) > 0 && (
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">到账</span>
                  <span className="font-semibold">≈ {Number(quote.cryptoAmount).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>汇率</span>
                  <span>1 CNY ≈ {Number(quote.midRate).toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>手续费</span>
                  <span>{Number(quote.feeAmount).toFixed(2)} USDT ({(Number(quote.feeRate) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!fiatAmount || Number(fiatAmount) <= 0 || !quote}
              onClick={handleNext}
            >
              下一步
            </Button>
          </div>
        )}

        {/* Step 2: Payment method selection */}
        {step === "method" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">选择付款方式</p>
            <div className="space-y-2">
              {paymentMethods?.map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setSelectedMethod(pm)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedMethod?.id === pm.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50"
                  }`}
                >
                  <div className="font-medium">{pm.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    收款姓名: {pm.accountName}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {pm.accountNumber}
                  </div>
                </button>
              ))}
              {!paymentMethods?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无可用付款方式</p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!selectedMethod || createOrder.isPending}
              onClick={handleNext}
            >
              {createOrder.isPending ? "创建中..." : "确认，去付款"}
            </Button>
          </div>
        )}

        {/* Step 3: Proof upload */}
        {step === "proof" && order && selectedMethod && (
          <div className="mt-6 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="font-medium">请向以下账号付款</div>
              <div className="text-muted-foreground">{selectedMethod.displayName}: <span className="font-mono">{selectedMethod.accountNumber}</span></div>
              <div className="text-muted-foreground">姓名: {selectedMethod.accountName}</div>
              <div className="text-lg font-bold mt-2">¥{Number(order.fiatAmount).toFixed(2)}</div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">付款后上传截图</p>
              <button
                className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {proofFile ? (
                  <div className="text-sm text-center">
                    <CheckCircle2 className="mx-auto mb-1 text-green-400" size={24} />
                    {proofFile.name}
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">点击选择图片</span>
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Input
              placeholder="备注（付款方昵称，可选）"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
            />

            <Button
              className="w-full"
              disabled={!proofFile || submitProof.isPending}
              onClick={handleNext}
            >
              {submitProof.isPending ? "提交中..." : "提交凭证"}
            </Button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && order && (
          <div className="mt-10 text-center space-y-4">
            <CheckCircle2 className="mx-auto text-green-400" size={56} />
            <h3 className="text-lg font-semibold">凭证已提交</h3>
            <p className="text-sm text-muted-foreground">通常在 30 分钟内审核完成，审核通过后资产自动到账</p>
            <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">订单号</span>
                <span className="font-mono text-xs">{order.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">支付金额</span>
                <span>¥{Number(order.fiatAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">预计到账</span>
                <span>≈ {Number(order.cryptoAmount).toFixed(2)} USDT</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>关闭</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FiatOnrampSheet;
