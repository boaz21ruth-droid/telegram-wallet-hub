import { useState } from "react";
import { toast } from "sonner";
import { Landmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useAdminPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from "@/hooks/use-admin-payment-methods";
import type { FiatPaymentMethod } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  code: string;
  displayName: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  code: "",
  displayName: "",
  accountName: "",
  accountNumber: "",
  isActive: true,
  sortOrder: 0,
};

// ── Method card ───────────────────────────────────────────────────────────────

function MethodCard({
  method,
  selected,
  onSelect,
}: {
  method: FiatPaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-3 transition-colors border ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-secondary/50 hover:bg-secondary"
      }`}
    >
      <p className="text-sm font-semibold text-foreground">{method.displayName}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{method.accountName}</p>
      <p className="text-xs text-muted-foreground font-mono truncate">{method.accountNumber}</p>
      <span
        className={`text-xs mt-1 inline-block ${method.isActive ? "text-green-400" : "text-muted-foreground"}`}
      >
        {method.isActive ? "● 启用" : "○ 停用"}
      </span>
    </button>
  );
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function EditPanel({
  method,
  isNew,
  onSaved,
  onDeleted,
}: {
  method: FiatPaymentMethod | null;
  isNew: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    method
      ? {
          code: method.code,
          displayName: method.displayName,
          accountName: method.accountName,
          accountNumber: method.accountNumber,
          isActive: method.isActive,
          sortOrder: method.sortOrder,
        }
      : EMPTY_FORM,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const del = useDeletePaymentMethod();

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      if (isNew) {
        await create.mutateAsync(form);
        toast.success("支付方式已创建");
      } else {
        const { code: _code, ...updateBody } = form;
        await update.mutateAsync({ id: method!.id, body: updateBody });
        toast.success("已更新");
      }
      onSaved();
    } catch {
      toast.error(isNew ? "创建失败" : "更新失败");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await del.mutateAsync(method!.id);
      toast.success("已删除");
      onDeleted();
    } catch {
      toast.error("删除失败");
    }
  };

  const isPending = create.isPending || update.isPending || del.isPending;
  const canSave =
    !!form.code.trim() &&
    !!form.displayName.trim() &&
    !!form.accountName.trim() &&
    !!form.accountNumber.trim();

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-foreground">
        {isNew ? "新增支付方式" : `编辑：${method?.displayName}`}
      </h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">渠道标识 (code)</label>
            <Input
              value={form.code}
              onChange={(e) => set("code")(e.target.value)}
              disabled={!isNew}
              placeholder="如 ccb / wechat / alipay"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">显示名称</label>
            <Input
              value={form.displayName}
              onChange={(e) => set("displayName")(e.target.value)}
              placeholder="如 建设银行"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">账户名（持卡人 / 账户）</label>
          <Input
            value={form.accountName}
            onChange={(e) => set("accountName")(e.target.value)}
            placeholder="如 张三"
            className="h-9 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">账号 / 收款码</label>
          <Input
            value={form.accountNumber}
            onChange={(e) => set("accountNumber")(e.target.value)}
            placeholder="银行卡号、手机号或收款 ID"
            className="h-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              排序权重（数小优先）
            </label>
            <Input
              value={form.sortOrder}
              onChange={(e) => set("sortOrder")(Number(e.target.value))}
              type="number"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive")(v)}
            />
            <span className="text-sm text-muted-foreground">
              {form.isActive ? "启用（用户可选）" : "停用"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={!canSave || isPending} className="flex-1">
          {isPending ? "保存中..." : "保存"}
        </Button>
        {!isNew && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="shrink-0"
          >
            {confirmDelete ? "确认删除" : "删除"}
          </Button>
        )}
      </div>

      {confirmDelete && (
        <p className="text-xs text-destructive">再次点击「确认删除」将永久删除此支付方式。</p>
      )}

      <p className="text-xs text-muted-foreground">停用后用户无法选择此渠道，不影响历史订单。</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const AdminPaymentMethodsPage = () => {
  const { data: methods, isLoading } = useAdminPaymentMethods();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const selected = methods?.find((m) => m.id === selectedId) ?? null;

  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
  };
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsNew(false);
  };
  const handleSaved = () => setIsNew(false);
  const handleDeleted = () => {
    setSelectedId(null);
    setIsNew(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Landmark size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">支付方式管理</h1>
      </div>

      <div className="flex gap-5 items-start">
        {/* Left: list */}
        <div className="w-72 shrink-0 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {methods?.map((m) => (
                <MethodCard
                  key={m.id}
                  method={m}
                  selected={selectedId === m.id}
                  onSelect={() => handleSelect(m.id)}
                />
              ))}
              {!methods?.length && !isNew && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无收款账号</p>
              )}
            </>
          )}
          <Button variant="outline" className="w-full" onClick={handleNew} disabled={isNew}>
            <Plus size={14} className="mr-1" />
            新增账号
          </Button>
        </div>

        {/* Right: edit panel */}
        <div className="flex-1">
          {isNew || selected ? (
            <EditPanel
              key={selectedId ?? "new"}
              method={selected}
              isNew={isNew}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
              ← 选择左侧账号进行编辑
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentMethodsPage;
