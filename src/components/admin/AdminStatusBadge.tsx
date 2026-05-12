import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  ACTIVE: "正常",
  SUSPENDED: "暂停",
  DISABLED: "禁用",
  UNVERIFIED: "未认证",
  PENDING: "待处理",
  VERIFIED: "已认证",
  REJECTED: "已拒绝",
  CONFIRMED: "已确认",
  PENDING_REVIEW: "待审核",
  READY_FOR_SIGNING: "待签名",
  SIGNED: "已签名",
  FAILED: "失败",
  APPROVED: "已通过",
  NOT_REQUIRED: "免审核",
  CANCELED: "已取消",
  CANCELLED: "已取消",
  FROZEN: "已冻结",
  CLOSED: "已关闭",
  USER: "用户",
  ADMIN: "管理员",
  SYSTEM: "系统",
  // Fiat on-ramp
  COMPLETED: "已完成",
  PENDING_PAYMENT: "待付款",
  PAYMENT_SUBMITTED: "已上传凭证",
  UNDER_REVIEW: "审核中",
  EXPIRED: "已过期",
};

const TONES: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  VERIFIED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  APPROVED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  READY_FOR_SIGNING: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  SIGNED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  PENDING_REVIEW: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  NOT_REQUIRED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  UNVERIFIED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  USER: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  ADMIN: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  SYSTEM: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  SUSPENDED: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  FROZEN: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  DISABLED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  REJECTED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  CLOSED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  CANCELED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  EXPIRED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PENDING_PAYMENT: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  PAYMENT_SUBMITTED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  UNDER_REVIEW: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export function AdminStatusBadge({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        TONES[value] ?? "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {LABELS[value] ?? value}
    </Badge>
  );
}
