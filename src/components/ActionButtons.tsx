import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowUpFromLine, Repeat2, GitFork, Banknote } from "lucide-react";
import SendSheet from "./SendSheet";
import ReceiveSheet from "./ReceiveSheet";
import WithdrawSheet from "./WithdrawSheet";
import SwapSheet from "./SwapSheet";
import BridgeSheet from "./BridgeSheet";
import FiatOnrampSheet from "./FiatOnrampSheet";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        showScanQrPopup: (
          params: { text?: string },
          callback: (result: string) => boolean | void
        ) => void;
      };
    };
  }
}

type SheetType = "send" | "receive" | "withdraw" | "swap" | "bridge" | "fiat" | null;

const ActionButtons = () => {
  const [open, setOpen] = useState<SheetType>(null);
  const [scanAddress, setScanAddress] = useState("");

  const actions = [
    { icon: ArrowUpRight,    label: "发送",  sheet: "send"    as SheetType, color: "bg-primary btn-glow" },
    { icon: ArrowDownLeft,   label: "接收",  sheet: "receive" as SheetType, color: "bg-success" },
    { icon: ArrowUpFromLine, label: "提现",  sheet: "withdraw" as SheetType, color: "bg-secondary" },
    { icon: Repeat2,         label: "兑换",  sheet: "swap"    as SheetType, color: "bg-accent" },
    { icon: GitFork,         label: "跨链",  sheet: "bridge"  as SheetType, color: "bg-muted-foreground/60" },
    { icon: Banknote,        label: "买币",  sheet: "fiat"    as SheetType, color: "bg-yellow-500/80" },
  ];

  const handleActionClick = (action: typeof actions[number]) => {
    if (action.sheet) setOpen(action.sheet);
  };

  return (
    <>
      <div className="flex justify-between px-4 mt-6">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleActionClick(action)}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center text-primary-foreground transition-transform group-hover:scale-105 group-active:scale-95`}
            >
              <action.icon size={20} />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      <SendSheet    open={open === "send"}    onClose={() => setOpen(null)} />
      <ReceiveSheet open={open === "receive"} onClose={() => setOpen(null)} />
      <WithdrawSheet
        open={open === "withdraw"}
        onClose={() => { setOpen(null); setScanAddress(""); }}
        initialAddress={scanAddress}
      />
      <SwapSheet        open={open === "swap"}   onClose={() => setOpen(null)} />
      <BridgeSheet      open={open === "bridge"} onClose={() => setOpen(null)} />
      <FiatOnrampSheet  open={open === "fiat"}   onClose={() => setOpen(null)} />
    </>
  );
};

export default ActionButtons;
