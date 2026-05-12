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
  FROZEN: "已冻结",
  CLOSED: "已关闭",
  USER: "用户",
  ADMIN: "管理员",
  SYSTEM: "系统",
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
