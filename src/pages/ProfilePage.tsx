import { LogOut, User, Shield, BadgeCheck, Clock, XCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── helpers ───────────────────────────────────────────────────────────────────

const KYC_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  NONE:     { label: "未认证",   color: "text-muted-foreground", Icon: User },
  PENDING:  { label: "审核中",   color: "text-yellow-400",       Icon: Clock },
  APPROVED: { label: "已认证",   color: "text-green-400",        Icon: BadgeCheck },
  REJECTED: { label: "认证失败", color: "text-destructive",      Icon: XCircle },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE:   { label: "正常",   color: "text-green-400" },
  FROZEN:   { label: "已冻结", color: "text-destructive" },
  INACTIVE: { label: "未激活", color: "text-muted-foreground" },
};

function InfoRow({
  label,
  value,
  valueClass = "text-foreground",
  icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className={`flex items-center gap-1 text-sm font-medium ${valueClass}`}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
        destructive
          ? "bg-destructive/10 hover:bg-destructive/20 text-destructive"
          : "bg-secondary/50 hover:bg-secondary text-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {!destructive && <ChevronRight size={16} className="text-muted-foreground" />}
    </button>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const displayName =
    user.firstName
      ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
      : user.username ?? "钱包用户";

  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const kyc = KYC_META[user.kycStatus] ?? KYC_META.NONE;
  const status = STATUS_META[user.status] ?? { label: user.status, color: "text-foreground" };

  const handleLogout = async () => {
    await logout();
    toast.success("已退出登录");
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground">我的</h1>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-6">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl ring-2 ring-primary/20">
            {initials}
          </div>
        )}
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{displayName}</p>
          {user.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
        </div>

        {/* Role badge */}
        {user.role === "ADMIN" && (
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
            <Shield size={12} />
            管理员
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="mx-6 mb-4 rounded-xl bg-secondary/50 px-4">
        <InfoRow label="账户状态" value={status.label} valueClass={status.color} />
        <InfoRow
          label="KYC 认证"
          value={kyc.label}
          valueClass={kyc.color}
          icon={<kyc.Icon size={14} />}
        />
        <InfoRow label="Telegram ID" value={user.telegramUserId} />
        <InfoRow
          label="注册时间"
          value={new Date(user.createdAt).toLocaleDateString("zh-CN")}
        />
      </div>

      {/* Wallet summary */}
      <div className="mx-6 mb-4 rounded-xl bg-secondary/50 px-4">
        {user.walletAccounts.map((acc) => (
          <InfoRow
            key={acc.id}
            label={`${acc.assetCode} 余额`}
            value={`${parseFloat(acc.availableBalance).toFixed(
              acc.assetCode === "USDT" ? 2 : 4,
            )} ${acc.assetCode}`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mx-6 space-y-3">
        <MenuItem
          icon={<LogOut size={18} />}
          label="退出登录"
          onClick={handleLogout}
          destructive
        />
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8 px-6">
        Telegram Wallet · 安全托管
      </p>
    </div>
  );
};

export default ProfilePage;
