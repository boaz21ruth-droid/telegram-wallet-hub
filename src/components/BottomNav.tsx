import { Wallet, BarChart3, Repeat, User } from "lucide-react";

const NAV_ITEMS = [
  { icon: Wallet,    label: "钱包" },
  { icon: BarChart3, label: "行情" },
  { icon: Repeat,    label: "交易" },
  { icon: User,      label: "我的" },
];

interface Props {
  active: number;
  onTabChange: (index: number) => void;
}

const BottomNav = ({ active, onTabChange }: Props) => (
  <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-border">
    <div className="max-w-lg mx-auto flex justify-around py-2 pb-safe">
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item.label}
          onClick={() => onTabChange(i)}
          className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
            active === i
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default BottomNav;
