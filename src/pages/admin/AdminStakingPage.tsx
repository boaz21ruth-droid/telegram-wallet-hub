import { useState } from "react";
import { toast } from "sonner";
import { PiggyBank, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminStakingProducts,
  useCreateStakingProduct,
  useUpdateStakingProduct,
  useAdminStakingOrders,
} from "@/hooks/use-admin-staking";
import type { StakingProduct, AdminStakingOrder, StakingOrderStatus } from "@/lib/api";

// ── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: StakingProduct }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(product.name);
  const [apy, setApy] = useState(product.currentApy);
  const update = useUpdateStakingProduct();

  const handleSave = async () => {
    try {
      await update.mutateAsync({ id: product.id, body: { name, currentApy: apy } });
      toast.success("已更新");
      setExpanded(false);
    } catch {
      toast.error("更新失败");
    }
  };

  const handleToggle = async () => {
    try {
      await update.mutateAsync({ id: product.id, body: { isActive: !product.isActive } });
      toast.success(product.isActive ? "已停用" : "已启用");
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        product.isActive
          ? "border-border bg-secondary/50"
          : "border-border/40 bg-secondary/20 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-foreground text-sm">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.assetCode}/{product.network} ·{" "}
            {product.productType === "FLEXIBLE" ? "活期" : `定期 ${product.lockDays} 天`}
          </p>
          <p className="text-lg font-bold text-green-400 mt-1">
            {(parseFloat(product.currentApy) * 100).toFixed(2)}% APY
          </p>
          <p className="text-xs text-muted-foreground">
            最低 {parseFloat(product.minAmount).toFixed(2)} {product.assetCode}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              product.isActive
                ? "bg-green-400/10 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {product.isActive ? "启用" : "停用"}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">产品名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                APY（小数，如 0.042 = 4.2%）
              </label>
              <Input
                value={apy}
                onChange={(e) => setApy(e.target.value)}
                className="h-8 text-sm"
                type="number"
                step="0.001"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={update.isPending}
              className="flex-1"
            >
              保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggle}
              disabled={update.isPending}
              className={
                product.isActive
                  ? "text-destructive border-destructive/30 hover:bg-destructive/10"
                  : ""
              }
            >
              {product.isActive ? "停用" : "启用"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New product form ──────────────────────────────────────────────────────────

const ASSET_NETWORK_OPTIONS = [
  { label: "USDT / TRC20", value: "USDT/TRC20" },
  { label: "USDT / TON", value: "USDT/TON" },
  { label: "TON / TON", value: "TON/TON" },
];

function NewProductForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [assetNetwork, setAssetNetwork] = useState("USDT/TRC20");
  const [productType, setProductType] = useState<"FLEXIBLE" | "FIXED">("FLEXIBLE");
  const [minAmount, setMinAmount] = useState("10");
  const [lockDays, setLockDays] = useState("0");
  const [apy, setApy] = useState("0.042");
  const create = useCreateStakingProduct();

  const handleCreate = async () => {
    const [assetCode, network] = assetNetwork.split("/");
    try {
      await create.mutateAsync({
        name,
        assetCode,
        network,
        productType,
        minAmount,
        lockDays: Number(lockDays),
        currentApy: apy,
      });
      toast.success("产品已创建");
      onClose();
    } catch {
      toast.error("创建失败");
    }
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">新建质押产品</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">产品名称</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：USDT 活期理财"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">资产 / 网络</label>
          <Select value={assetNetwork} onValueChange={setAssetNetwork}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_NETWORK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">产品类型</label>
          <Select
            value={productType}
            onValueChange={(v) => setProductType(v as "FLEXIBLE" | "FIXED")}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FLEXIBLE">活期</SelectItem>
              <SelectItem value="FIXED">定期</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">最低金额</label>
          <Input
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            type="number"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            锁仓天数（活期填 0）
          </label>
          <Input
            value={lockDays}
            onChange={(e) => setLockDays(e.target.value)}
            type="number"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            APY（小数，如 0.042 = 4.2%）
          </label>
          <Input
            value={apy}
            onChange={(e) => setApy(e.target.value)}
            type="number"
            step="0.001"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || create.isPending}
          className="flex-1"
        >
          {create.isPending ? "创建中..." : "确认创建"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}

// ── Orders table ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { label: string; value: StakingOrderStatus | "ALL" }[] = [
  { label: "全部", value: "ALL" },
  { label: "持仓中", value: "ACTIVE" },
  { label: "赎回中", value: "REDEEMING" },
  { label: "已赎回", value: "REDEEMED" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-green-400",
  REDEEMING: "text-yellow-400",
  REDEEMED: "text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "持仓中",
  REDEEMING: "赎回中",
  REDEEMED: "已赎回",
};

const LIMIT = 20;

function OrdersTable() {
  const [statusFilter, setStatusFilter] = useState<StakingOrderStatus | "ALL">("ALL");
  const [offset, setOffset] = useState(0);

  const { data: orders, isLoading } = useAdminStakingOrders({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    limit: LIMIT,
    offset,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">用户持仓订单</h2>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StakingOrderStatus | "ALL");
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : !orders?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">暂无订单</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2">用户 ID</th>
                <th className="text-left px-4 py-2">产品</th>
                <th className="text-right px-4 py-2">本金</th>
                <th className="text-right px-4 py-2">累计收益</th>
                <th className="text-center px-4 py-2">状态</th>
                <th className="text-right px-4 py-2">质押时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o: AdminStakingOrder) => (
                <tr key={o.id} className="bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs">{o.user.telegramUserId}</td>
                  <td className="px-4 py-2">{o.product.name}</td>
                  <td className="px-4 py-2 text-right">
                    {parseFloat(o.principal).toFixed(2)} {o.assetCode}
                  </td>
                  <td className="px-4 py-2 text-right text-green-400">
                    +{parseFloat(o.accruedYield).toFixed(6)}
                  </td>
                  <td
                    className={`px-4 py-2 text-center text-xs font-medium ${STATUS_COLORS[o.status] ?? ""}`}
                  >
                    {STATUS_LABELS[o.status] ?? o.status}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {((orders?.length ?? 0) === LIMIT || offset > 0) && (
        <div className="flex justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(orders?.length ?? 0) < LIMIT}
            onClick={() => setOffset((o) => o + LIMIT)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const AdminStakingPage = () => {
  const { data: products, isLoading } = useAdminStakingProducts();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="space-y-8">
      {/* Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <PiggyBank size={18} className="text-yellow-400" />
            质押产品配置
          </h2>
          <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
            <Plus size={14} className="mr-1" />
            新建产品
          </Button>
        </div>

        <div className="space-y-3">
          {showNewForm && <NewProductForm onClose={() => setShowNewForm(false)} />}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : !products?.length && !showNewForm ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              暂无产品，点击「新建产品」开始配置
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products?.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Orders */}
      <OrdersTable />
    </div>
  );
};

export default AdminStakingPage;
