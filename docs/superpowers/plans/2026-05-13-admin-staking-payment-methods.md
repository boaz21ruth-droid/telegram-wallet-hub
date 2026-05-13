# Admin Staking + Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin management pages for staking products and fiat payment methods, plus sidebar nav entries for both.

**Architecture:** Backend gains 4 payment-method CRUD endpoints in the existing admin fiat-onramp controller. Frontend adds two new pages (AdminStakingPage, AdminPaymentMethodsPage), two hook files, expands the adminApi client and permissions, then wires up routes and nav.

**Tech Stack:** NestJS + Prisma (backend), React 18 + TanStack Query + shadcn/ui + Tailwind (frontend), Vitest (tests)

---

## File Map

| File | Change |
|---|---|
| `backend/src/modules/fiat-onramp/fiat-onramp.service.ts` | Add 4 admin CRUD methods for FiatPaymentMethod |
| `backend/src/modules/fiat-onramp/admin-fiat-onramp.controller.ts` | Add 4 payment-method endpoints |
| `src/lib/admin.ts` | Add `staking:view` + `payment-methods:manage` to type + role arrays |
| `src/test/admin-utils.test.ts` | Add 2 permission tests |
| `src/lib/api.ts` | Add `AdminStakingOrder` interface + `adminApi.staking` + payment-method methods on `adminApi.fiatOnramp` |
| `src/hooks/use-admin-staking.ts` | New file — 4 hooks |
| `src/hooks/use-admin-payment-methods.ts` | New file — 4 hooks |
| `src/pages/admin/AdminStakingPage.tsx` | New file |
| `src/pages/admin/AdminPaymentMethodsPage.tsx` | New file |
| `src/components/admin/AdminLayout.tsx` | Add 2 NAV_ITEMS entries |
| `src/AdminApp.tsx` | Add 2 routes + imports |

---

### Task 1: Backend — payment methods CRUD service + admin endpoints

**Files:**
- Modify: `backend/src/modules/fiat-onramp/fiat-onramp.service.ts`
- Modify: `backend/src/modules/fiat-onramp/admin-fiat-onramp.controller.ts`

- [ ] **Step 1: Add 4 service methods to fiat-onramp.service.ts**

Append before the closing `}` of the `FiatOnrampService` class:

```typescript
  async adminListPaymentMethods() {
    return this.prisma.fiatPaymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async adminCreatePaymentMethod(dto: {
    code: string;
    displayName: string;
    accountName: string;
    accountNumber: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.fiatPaymentMethod.create({ data: dto });
  }

  async adminUpdatePaymentMethod(
    id: string,
    dto: {
      displayName?: string;
      accountName?: string;
      accountNumber?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.fiatPaymentMethod.update({ where: { id }, data: dto });
  }

  async adminDeletePaymentMethod(id: string) {
    await this.prisma.fiatPaymentMethod.delete({ where: { id } });
  }
```

- [ ] **Step 2: Replace admin-fiat-onramp.controller.ts with the expanded version**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { ReviewFiatOrderDto } from "./dto/review-fiat-order.dto";
import { FiatOnrampService } from "./fiat-onramp.service";

class CreatePaymentMethodDto {
  @IsString() code!: string;
  @IsString() displayName!: string;
  @IsString() accountName!: string;
  @IsString() accountNumber!: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsNumber() @IsOptional() sortOrder?: number;
}

class UpdatePaymentMethodDto {
  @IsString() @IsOptional() displayName?: string;
  @IsString() @IsOptional() accountName?: string;
  @IsString() @IsOptional() accountNumber?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsNumber() @IsOptional() sortOrder?: number;
}

@Controller("admin/fiat-onramp")
@Public()
@UseGuards(AdminGuard)
export class AdminFiatOnrampController {
  constructor(private readonly fiatService: FiatOnrampService) {}

  @Get("orders")
  listOrders(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
  ) {
    return this.fiatService.listAdminOrders(
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
      status,
    );
  }

  @Post("orders/:id/review-start")
  startReview(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string) {
    return this.fiatService.startReview(admin.id, id);
  }

  @Post("orders/:id/approve")
  approve(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param("id") id: string,
    @Body() body: ReviewFiatOrderDto,
  ) {
    return this.fiatService.approveOrder(admin.id, id, body.reviewerNote);
  }

  @Post("orders/:id/reject")
  reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param("id") id: string,
    @Body() body: ReviewFiatOrderDto,
  ) {
    return this.fiatService.rejectOrder(admin.id, id, body.reviewerNote);
  }

  @Get("payment-methods")
  listPaymentMethods() {
    return this.fiatService.adminListPaymentMethods();
  }

  @Post("payment-methods")
  createPaymentMethod(@Body() body: CreatePaymentMethodDto) {
    return this.fiatService.adminCreatePaymentMethod(body);
  }

  @Patch("payment-methods/:id")
  updatePaymentMethod(@Param("id") id: string, @Body() body: UpdatePaymentMethodDto) {
    return this.fiatService.adminUpdatePaymentMethod(id, body);
  }

  @Delete("payment-methods/:id")
  deletePaymentMethod(@Param("id") id: string) {
    return this.fiatService.adminDeletePaymentMethod(id);
  }
}
```

- [ ] **Step 3: Verify backend compiles**

```bash
cd backend && npm run lint
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/fiat-onramp/fiat-onramp.service.ts \
        backend/src/modules/fiat-onramp/admin-fiat-onramp.controller.ts
git commit -m "feat(admin): add payment methods CRUD endpoints"
```

---

### Task 2: Frontend permissions

**Files:**
- Modify: `src/lib/admin.ts`
- Modify: `src/test/admin-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/test/admin-utils.test.ts`:

```typescript
describe("new permissions", () => {
  it("allows staking:view for all roles", () => {
    expect(hasAdminPermission("SUPER_ADMIN", "staking:view")).toBe(true);
    expect(hasAdminPermission("OPS_REVIEWER", "staking:view")).toBe(true);
    expect(hasAdminPermission("FINANCE_OPERATOR", "staking:view")).toBe(true);
  });

  it("restricts payment-methods:manage to super admin and finance operator", () => {
    expect(hasAdminPermission("SUPER_ADMIN", "payment-methods:manage")).toBe(true);
    expect(hasAdminPermission("FINANCE_OPERATOR", "payment-methods:manage")).toBe(true);
    expect(hasAdminPermission("OPS_REVIEWER", "payment-methods:manage")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run src/test/admin-utils.test.ts
```

Expected: 2 failing tests ("Argument of type ... is not assignable" or runtime false ≠ true).

- [ ] **Step 3: Update src/lib/admin.ts**

Replace the file content:

```typescript
import type { AdminPrincipal, AdminRole } from "@/lib/api";

export type AdminPermission =
  | "dashboard:view"
  | "users:view"
  | "users:edit"
  | "deposits:view"
  | "deposits:credit"
  | "deposits:assign_address"
  | "withdrawals:view"
  | "withdrawals:review"
  | "withdrawals:sign"
  | "withdrawals:confirm"
  | "withdrawals:fail"
  | "adjustments:view"
  | "adjustments:create"
  | "audit:view"
  | "kyc:review"
  | "fiat-onramp:view"
  | "fiat-onramp:review"
  | "staking:view"
  | "payment-methods:manage";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_REVIEWER: "Ops Reviewer",
  FINANCE_OPERATOR: "Finance Operator",
};

const PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    "dashboard:view",
    "users:view",
    "users:edit",
    "deposits:view",
    "deposits:credit",
    "deposits:assign_address",
    "withdrawals:view",
    "withdrawals:review",
    "withdrawals:sign",
    "withdrawals:confirm",
    "withdrawals:fail",
    "adjustments:view",
    "adjustments:create",
    "audit:view",
    "kyc:review",
    "fiat-onramp:view",
    "fiat-onramp:review",
    "staking:view",
    "payment-methods:manage",
  ],
  OPS_REVIEWER: [
    "dashboard:view",
    "users:view",
    "users:edit",
    "deposits:view",
    "deposits:assign_address",
    "withdrawals:view",
    "withdrawals:review",
    "audit:view",
    "kyc:review",
    "fiat-onramp:view",
    "fiat-onramp:review",
    "staking:view",
  ],
  FINANCE_OPERATOR: [
    "dashboard:view",
    "deposits:view",
    "deposits:credit",
    "withdrawals:view",
    "withdrawals:sign",
    "withdrawals:confirm",
    "withdrawals:fail",
    "adjustments:view",
    "adjustments:create",
    "audit:view",
    "fiat-onramp:view",
    "staking:view",
    "payment-methods:manage",
  ],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function isAdminAuthenticated(admin: AdminPrincipal | null): boolean {
  return !!admin && admin.isActive;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/test/admin-utils.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/test/admin-utils.test.ts
git commit -m "feat(admin): add staking:view and payment-methods:manage permissions"
```

---

### Task 3: API types + client

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add AdminStakingOrder interface**

Find the `export interface FiatPaymentMethod` block and insert before it:

```typescript
export interface AdminStakingOrder {
  id: string;
  userId: string;
  productId: string;
  assetCode: string;
  network: string;
  principal: string;
  accruedYield: string;
  status: StakingOrderStatus;
  maturesAt: string | null;
  createdAt: string;
  user: { id: string; telegramUserId: string; username: string | null };
  product: StakingProduct;
}
```

- [ ] **Step 2: Add adminApi.staking namespace**

Inside the `adminApi` object (after the `wallet:` block, before the closing `}`), add:

```typescript
  staking: {
    products: () => adminRequest<StakingProduct[]>("/admin/staking/products"),
    createProduct: (body: {
      name: string;
      assetCode: string;
      network: string;
      productType: StakingProductType;
      minAmount: string;
      lockDays?: number;
      currentApy?: string;
      description?: string;
    }) =>
      adminRequest<StakingProduct>("/admin/staking/products", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateProduct: (id: string, body: { name?: string; currentApy?: string; isActive?: boolean }) =>
      adminRequest<StakingProduct>(`/admin/staking/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    orders: (
      params: {
        status?: StakingOrderStatus;
        userId?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      const q = new URLSearchParams();
      if (params.status) q.set("status", params.status);
      if (params.userId) q.set("userId", params.userId);
      if (params.limit) q.set("limit", String(params.limit));
      if (params.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return adminRequest<AdminStakingOrder[]>(`/admin/staking/orders${qs ? `?${qs}` : ""}`);
    },
  },
```

- [ ] **Step 3: Extend adminApi.fiatOnramp with payment method methods**

Find the `fiatOnramp:` block in `adminApi` and add 4 methods inside it (after the `reject:` entry):

```typescript
    paymentMethods: () =>
      adminRequest<FiatPaymentMethod[]>("/admin/fiat-onramp/payment-methods"),
    createPaymentMethod: (body: {
      code: string;
      displayName: string;
      accountName: string;
      accountNumber: string;
      isActive?: boolean;
      sortOrder?: number;
    }) =>
      adminRequest<FiatPaymentMethod>("/admin/fiat-onramp/payment-methods", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updatePaymentMethod: (
      id: string,
      body: {
        displayName?: string;
        accountName?: string;
        accountNumber?: string;
        isActive?: boolean;
        sortOrder?: number;
      },
    ) =>
      adminRequest<FiatPaymentMethod>(`/admin/fiat-onramp/payment-methods/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deletePaymentMethod: (id: string) =>
      adminRequest<void>(`/admin/fiat-onramp/payment-methods/${id}`, { method: "DELETE" }),
```

- [ ] **Step 4: Verify frontend type-checks**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(admin): add staking + payment-method API types and client methods"
```

---

### Task 4: Admin staking hooks

**Files:**
- Create: `src/hooks/use-admin-staking.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import type { StakingOrderStatus } from "@/lib/api";

export function useAdminStakingProducts() {
  return useQuery({
    queryKey: ["admin", "staking", "products"],
    queryFn: () => adminApi.staking.products(),
  });
}

export function useCreateStakingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.staking.createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staking", "products"] }),
  });
}

export function useUpdateStakingProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; currentApy?: string; isActive?: boolean };
    }) => adminApi.staking.updateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staking", "products"] }),
  });
}

export function useAdminStakingOrders(
  params: { status?: StakingOrderStatus; limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: ["admin", "staking", "orders", params],
    queryFn: () => adminApi.staking.orders(params),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-admin-staking.ts
git commit -m "feat(admin): add admin staking hooks"
```

---

### Task 5: Admin payment methods hooks

**Files:**
- Create: `src/hooks/use-admin-payment-methods.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";

const QK = ["admin", "payment-methods"] as const;

export function useAdminPaymentMethods() {
  return useQuery({ queryKey: QK, queryFn: () => adminApi.fiatOnramp.paymentMethods() });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.fiatOnramp.createPaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof adminApi.fiatOnramp.updatePaymentMethod>[1];
    }) => adminApi.fiatOnramp.updatePaymentMethod(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.fiatOnramp.deletePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-admin-payment-methods.ts
git commit -m "feat(admin): add admin payment methods hooks"
```

---

### Task 6: AdminStakingPage

**Files:**
- Create: `src/pages/admin/AdminStakingPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminStakingPage.tsx
git commit -m "feat(admin): add AdminStakingPage"
```

---

### Task 7: AdminPaymentMethodsPage

**Files:**
- Create: `src/pages/admin/AdminPaymentMethodsPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminPaymentMethodsPage.tsx
git commit -m "feat(admin): add AdminPaymentMethodsPage"
```

---

### Task 8: Wire up routes and nav

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/AdminApp.tsx`

- [ ] **Step 1: Update AdminLayout.tsx**

Add `PiggyBank` and `Landmark` to the lucide-react import:

```typescript
import { Banknote, Building2, CreditCard, FileClock, LayoutDashboard, Landmark, LogOut, PiggyBank, ShieldCheck, Users, Wallet } from "lucide-react";
```

Add two entries to `NAV_ITEMS` between the `fiat-onramp` and `adjustments` entries:

```typescript
  { to: "/staking",         label: "质押管理",    permission: "staking:view",           Icon: PiggyBank },
  { to: "/payment-methods", label: "支付方式管理", permission: "payment-methods:manage",  Icon: Landmark },
```

- [ ] **Step 2: Update AdminApp.tsx**

Add imports after the existing admin page imports:

```typescript
import AdminStakingPage from "@/pages/admin/AdminStakingPage";
import AdminPaymentMethodsPage from "@/pages/admin/AdminPaymentMethodsPage";
```

Add two routes inside the `<RequireAdmin>` / `<AdminLayout>` block (after the fiat-onramp route):

```tsx
            <Route element={<RequireAdmin permission="staking:view" />}>
              <Route path="/staking" element={<AdminStakingPage />} />
            </Route>
            <Route element={<RequireAdmin permission="payment-methods:manage" />}>
              <Route path="/payment-methods" element={<AdminPaymentMethodsPage />} />
            </Route>
```

- [ ] **Step 3: Verify lint + tests**

```bash
npm run lint && npx vitest run
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminLayout.tsx src/AdminApp.tsx
git commit -m "feat(admin): wire staking and payment-methods routes + nav"
```
