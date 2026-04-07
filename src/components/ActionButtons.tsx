import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, QrCode } from "lucide-react";

const actions = [
  { icon: ArrowUpRight, label: "发送", color: "bg-primary btn-glow" },
  { icon: ArrowDownLeft, label: "接收", color: "bg-success" },
  { icon: ArrowLeftRight, label: "兑换", color: "bg-secondary" },
  { icon: QrCode, label: "扫码", color: "bg-secondary" },
];

const ActionButtons = () => {
  return (
    <div className="flex justify-between px-6 mt-6">
      {actions.map((action) => (
        <button key={action.label} className="flex flex-col items-center gap-2 group">
          <div
            className={`w-14 h-14 rounded-2xl ${action.color} flex items-center justify-center text-primary-foreground transition-transform group-hover:scale-105 group-active:scale-95`}
          >
            <action.icon size={22} />
          </div>
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ActionButtons;
