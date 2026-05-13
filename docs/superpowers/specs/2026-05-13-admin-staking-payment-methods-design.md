# Admin Staking Management + Fiat Payment Methods Management

**Date:** 2026-05-13  
**Scope:** Three additions to the admin panel — staking management page, fiat payment methods management page, and sidebar nav entries for both.

---

## Problem

Two features shipped in the last merge (Staking, Fiat On-ramp) have no admin-facing management UI:

1. **Staking products** can only be created/edited via direct API calls; there is no way for ops to configure APY or enable/disable products from the admin panel.
2. **Fiat payment methods** (bank accounts, Alipay, WeChat) live in the `FiatPaymentMethod` table but have no CRUD interface — the database is empty, making the user-facing fiat buy flow non-functional.
3. Both features are missing sidebar nav entries in `AdminLayout`.

---

## Design Decisions

| Question | Decision |
|---|---|
| Staking page layout | Scrollable — product cards on top, orders table below (Option B) |
| Payment methods layout | Master-detail — left card list + right edit panel (Option B) |
| Sidebar placement | Both as independent top-level nav items (Option A) |
| Payment methods nav | Separate item `/payment-methods`, not a sub-tab of fiat-onramp |

---

## Section 1: Backend Changes

### Gap
`FiatPaymentMethod` has no admin CRUD. The existing `listPaymentMethods()` in `FiatOnrampService` only returns active items and is user-facing only.

### New service methods (fiat-onramp.service.ts)
- `adminListPaymentMethods()` — return all records ordered by `sortOrder`, including inactive
- `adminCreatePaymentMethod(dto)` — create with fields: `code`, `displayName`, `accountName`, `accountNumber`, `isActive`, `sortOrder`
- `adminUpdatePaymentMethod(id, dto)` — partial update of all fields
- `adminDeletePaymentMethod(id)` — hard delete (safe: no FK references from other tables)

### New admin endpoints (admin-fiat-onramp.controller.ts)
All guarded by `AdminGuard`. No user-facing equivalent.

| Method | Path | Action |
|---|---|---|
| `GET` | `/admin/fiat-onramp/payment-methods` | List all (incl. inactive) |
| `POST` | `/admin/fiat-onramp/payment-methods` | Create |
| `PATCH` | `/admin/fiat-onramp/payment-methods/:id` | Update |
| `DELETE` | `/admin/fiat-onramp/payment-methods/:id` | Delete |

`AdminStakingController` already exposes all required endpoints (product CRUD, order list). No backend changes needed for staking.

---

## Section 2: Permissions

### New permission literals (src/lib/admin.ts)
- `"staking:view"` — read staking products and user orders
- `"payment-methods:manage"` — full CRUD on fiat payment methods

### Role assignments

| Permission | SUPER_ADMIN | OPS_REVIEWER | FINANCE_OPERATOR |
|---|---|---|---|
| `staking:view` | ✅ | ✅ | ✅ |
| `payment-methods:manage` | ✅ | ❌ | ✅ |

Rationale: payment method management touches live collection accounts — a finance concern, not ops review. OPS_REVIEWER gets staking read-only to monitor user positions.

---

## Section 3: Frontend

### New files

**`src/pages/admin/AdminStakingPage.tsx`**

Layout (scrollable, top-to-bottom):

1. **Product section**
   - Grid of product cards. Each card: name, asset/network, APY (highlighted green), min amount, lock days, enabled/disabled badge.
   - Click a card → card expands inline with an edit form (name, APY, isActive toggle). Save/Cancel buttons.
   - "＋ 新建产品" button in section header → opens a new blank card at the top of the grid with all fields editable.
   - Fields for new product: name, description (optional), assetCode, network, productType (FLEXIBLE/FIXED), minAmount, lockDays, currentApy.

2. **Orders section** (below products, separated by a divider)
   - Table columns: 用户 Telegram ID, 产品名称, 本金, 累计收益, 状态, 质押时间.
   - Status filter dropdown: ALL / ACTIVE / REDEEMING / REDEEMED.
   - Pagination: 20 rows per page with prev/next controls.
   - Read-only — no admin actions on individual orders.

**`src/pages/admin/AdminPaymentMethodsPage.tsx`**

Layout (master-detail, side-by-side):

- **Left panel** (fixed width ~280px): vertical list of payment method cards.
  - Each card: displayName (large), accountName + accountNumber (small), isActive badge.
  - Selected card highlighted with primary color border.
  - Bottom: "＋ 新增账号" button — clicking clears right panel to blank create form.

- **Right panel** (flex-1): edit form for selected method, or blank create form.
  - Fields: `code` (unique identifier, e.g. "ccb", "wechat"), `displayName` (e.g. "建设银行"), `accountName` (持卡人/账户名), `accountNumber` (账号/收款码), `isActive` toggle, `sortOrder` (integer).
  - Buttons: Save (primary) + Delete (destructive red). Delete shows a confirmation before proceeding.
  - When nothing is selected, right panel shows a placeholder: "← 选择左侧账号进行编辑".

**`src/hooks/use-admin-staking.ts`**
- `useAdminStakingProducts()` — GET `/admin/staking/products`
- `useCreateStakingProduct()` — POST `/admin/staking/products`
- `useUpdateStakingProduct()` — PATCH `/admin/staking/products/:id`
- `useAdminStakingOrders(status?, page?)` — GET `/admin/staking/orders`

**`src/hooks/use-admin-payment-methods.ts`**
- `useAdminPaymentMethods()` — GET `/admin/fiat-onramp/payment-methods`
- `useCreatePaymentMethod()` — POST
- `useUpdatePaymentMethod()` — PATCH
- `useDeletePaymentMethod()` — DELETE

### Modified files

**`src/lib/admin.ts`**
- Add `"staking:view"` and `"payment-methods:manage"` to `AdminPermission` union type.
- Add to `PERMISSIONS` per role table above.

**`src/components/admin/AdminLayout.tsx`**
Add two entries to `NAV_ITEMS` (between fiat-onramp and adjustments):
```
{ to: "/staking",          label: "质押管理",    permission: "staking:view",           Icon: PiggyBank }
{ to: "/payment-methods",  label: "支付方式管理", permission: "payment-methods:manage", Icon: Landmark }
```

**`src/AdminApp.tsx`**
Add two routes inside `<RequireAdmin>`:
```
<Route element={<RequireAdmin permission="staking:view" />}>
  <Route path="/staking" element={<AdminStakingPage />} />
</Route>
<Route element={<RequireAdmin permission="payment-methods:manage" />}>
  <Route path="/payment-methods" element={<AdminPaymentMethodsPage />} />
</Route>
```

---

## Out of Scope

- Staking order admin actions (force-redeem, yield adjustment) — read-only view is sufficient for now.
- QR code image upload for payment methods — `qrCodePath` field exists in schema but upload infra is separate. Field is nullable; leave it out of this iteration.
- Swap orders admin page — separate task.

---

## File Checklist

| File | Change |
|---|---|
| `backend/src/modules/fiat-onramp/fiat-onramp.service.ts` | Add 4 admin CRUD methods |
| `backend/src/modules/fiat-onramp/admin-fiat-onramp.controller.ts` | Add 4 payment method endpoints |
| `src/lib/admin.ts` | Add 2 permissions + role assignments |
| `src/components/admin/AdminLayout.tsx` | Add 2 NAV_ITEMS entries |
| `src/AdminApp.tsx` | Add 2 routes |
| `src/hooks/use-admin-staking.ts` | New file — 4 hooks |
| `src/hooks/use-admin-payment-methods.ts` | New file — 4 hooks |
| `src/pages/admin/AdminStakingPage.tsx` | New file |
| `src/pages/admin/AdminPaymentMethodsPage.tsx` | New file |
