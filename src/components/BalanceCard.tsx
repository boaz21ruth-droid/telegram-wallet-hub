import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const BalanceCard = () => {
  const [visible, setVisible] = useState(true);

  return (
    <div className="mx-6 mt-4 p-6 rounded-2xl glass-card relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted-foreground">总资产</p>
          <button
            onClick={() => setVisible(!visible)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-1">
          {visible ? "$12,580.45" : "••••••"}
        </h1>
        <p className="text-sm text-success flex items-center gap-1">
          <span>↑ +2.34%</span>
          <span className="text-muted-foreground">今日</span>
        </p>
      </div>
    </div>
  );
};

export default BalanceCard;
