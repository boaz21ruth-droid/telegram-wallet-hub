import { Bell, Settings } from "lucide-react";

const WalletHeader = () => {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          TW
        </div>
        <div>
          <p className="text-sm text-muted-foreground">欢迎回来</p>
          <p className="font-semibold text-foreground">Telegram 钱包</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={18} />
        </button>
        <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};

export default WalletHeader;
