import { useState } from "react";
import { toast } from "sonner";
import { PiggyBank, TrendingUp, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStakingProducts, useMyStakingOrders, useStakeAsset, useRedeemStaking } from "@/hooks/use-staking";
import type { StakingProduct, StakingOrder } from "@/lib/api";

function formatApy(apy: string) {
  return `${(parseFloat(apy) * 100).toFixed(1)}%`;
}

function StakeSheet({
  product,
  open,
  onClose,
}: {
  product: StakingProduct | null;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const stake = useStakeAsset();

  const handleClose = () => { setAmount(""); setDone(false); onClose(); };

  const handleStake = async () => {
    if (!product) return;
    try {
      await stake.mutateAsync({ productId: product.id, amount });
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "质押失败");
    }
  };

  if (!product) return null;
  const minOk = !amount || parseFloat(amount) >= parseFloat(product.minAmount);
  const canSubmit = !!amount && parseFloat(amount) > 0 && minOk;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>质押 {product.assetCode}/{product.network}</SheetTitle>
        </SheetHeader>

        {!done ? (
          <div className="mt-6 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">预期年化</span>
                <span className="font-semibold text-green-400">{formatApy(product.currentApy)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>最低质押</span>
                <span>{parseFloat(product.minAmount).toFixed(2)} {product.assetCode}</span>
              </div>
              {product.lockDays > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>锁仓期</span>
                  <span>{product.lockDays} 天</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center bg-muted/50 rounded-xl p-4">
              <span className="text-muted-foreground font-medium">{product.assetCode}</span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 p-0"
              />
            </div>
            {!minOk && (
              <p className="text-xs text-destructive">
                最低质押金额 {parseFloat(product.minAmount).toFixed(2)} {product.assetCode}
              </p>
            )}

            <Button
              className="w-full"
              disabled={!canSubmit || stake.isPending}
              onClick={handleStake}
            >
              {stake.isPending ? "质押中..." : "确认质押"}
            </Button>
          </div>
        ) : (
          <div className="mt-10 text-center space-y-4">
            <CheckCircle2 className="mx-auto text-green-400" size={56} />
            <h3 className="text-lg font-semibold">质押成功</h3>
            <p className="text-sm text-muted-foreground">
              已质押 {parseFloat(amount).toFixed(2)} {product.assetCode}，每小时计息
            </p>
            <Button variant="outline" className="w-full" onClick={handleClose}>关闭</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RedeemSheet({
  order,
  open,
  onClose,
}: {
  order: StakingOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  const redeem = useRedeemStaking();

  const handleRedeem = async () => {
    if (!order) return;
    try {
      await redeem.mutateAsync(order.id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "赎回失败");
    }
  };

  if (!order) return null;
  const total = (parseFloat(order.principal) + parseFloat(order.accruedYield)).toFixed(4);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>赎回质押</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">本金</span>
              <span>{parseFloat(order.principal).toFixed(4)} {order.assetCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">累计收益</span>
              <span className="text-green-400">+{parseFloat(order.accruedYield).toFixed(6)} {order.assetCode}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-2 mt-1">
              <span>合计到账</span>
              <span>{total} {order.assetCode}</span>
            </div>
          </div>

          {order.maturesAt && new Date(order.maturesAt) > new Date() && (
            <p className="text-sm text-yellow-400 text-center">
              定期产品于 {new Date(order.maturesAt).toLocaleDateString("zh-CN")} 到期
            </p>
          )}

          <Button
            className="w-full"
            disabled={redeem.isPending}
            onClick={handleRedeem}
          >
            {redeem.isPending ? "赎回中..." : "确认赎回"}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>取消</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const EarnPage = () => {
  const { data: products, isLoading: productsLoading } = useStakingProducts();
  const { data: orders, isLoading: ordersLoading } = useMyStakingOrders();
  const [stakeProduct, setStakeProduct] = useState<StakingProduct | null>(null);
  const [redeemOrder, setRedeemOrder] = useState<StakingOrder | null>(null);

  const activeOrders = orders?.filter((o) => o.status === "ACTIVE") ?? [];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-6 pt-6">
        <h1 className="text-xl font-bold text-foreground mb-1">理财</h1>
        <p className="text-sm text-muted-foreground mb-6">质押资产赚取链上真实收益</p>

        {/* Products */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">推荐产品</h2>
          {productsLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : !products?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无可用产品</p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                        <PiggyBank size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.assetCode}/{p.network} · 最低 {parseFloat(p.minAmount).toFixed(0)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-400 font-semibold">
                        <TrendingUp size={14} />
                        {formatApy(p.currentApy)}
                      </div>
                      <p className="text-xs text-muted-foreground">年化</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setStakeProduct(p)}
                  >
                    立即质押
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My positions */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">我的持仓</h2>
          {ordersLoading ? (
            <div className="h-20 rounded-xl bg-secondary/50 animate-pulse" />
          ) : !activeOrders.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无持仓</p>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((o) => (
                <div key={o.id} className="p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">{o.product.name}</p>
                      <p className="text-xs text-muted-foreground">{o.assetCode}/{o.network}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{parseFloat(o.principal).toFixed(2)} {o.assetCode}</p>
                      <p className="text-xs text-green-400">
                        +{parseFloat(o.accruedYield).toFixed(6)} {o.assetCode}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRedeemOrder(o)}
                  >
                    赎回
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <StakeSheet
        product={stakeProduct}
        open={!!stakeProduct}
        onClose={() => setStakeProduct(null)}
      />
      <RedeemSheet
        order={redeemOrder}
        open={!!redeemOrder}
        onClose={() => setRedeemOrder(null)}
      />
    </div>
  );
};

export default EarnPage;
