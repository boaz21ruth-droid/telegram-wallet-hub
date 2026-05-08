import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const WalletHeader = () => {
  const { user, logout } = useAuth();

  const displayName =
    user?.firstName
      ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
      : user?.username ?? "钱包用户";

  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    toast.success("已退出登录");
  };

  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div className="flex items-center gap-3">
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">欢迎回来</p>
          <p className="font-semibold text-foreground">{displayName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={18} />
        </button>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default WalletHeader;
