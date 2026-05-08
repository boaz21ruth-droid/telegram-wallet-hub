import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowUpFromLine, QrCode } from "lucide-react";
import SendSheet from "./SendSheet";
import ReceiveSheet from "./ReceiveSheet";
import WithdrawSheet from "./WithdrawSheet";

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

type SheetType = "send" | "receive" | "withdraw" | null;

const ActionButtons = () => {
  const [open, setOpen] = useState<SheetType>(null);
  const [scanAddress, setScanAddress] = useState("");

  const actions = [
    { icon: ArrowUpRight,    label: "发送",  sheet: "send"     as SheetType, color: "bg-primary btn-glow" },
    { icon: ArrowDownLeft,   label: "接收",  sheet: "receive"  as SheetType, color: "bg-success" },
    { icon: ArrowUpFromLine, label: "提现",  sheet: "withdraw" as SheetType, color: "bg-secondary" },
    { icon: QrCode,          label: "扫码",  sheet: null,                    color: "bg-secondary" },
  ];

  const handleActionClick = (action: typeof actions[number]) => {
    if (action.label === "扫码") {
      window.Telegram?.WebApp.showScanQrPopup(
        { text: "扫描收款方 TON 钱包地址" },
        (result) => { setScanAddress(result); setOpen("withdraw"); return true; }
      );
    } else if (action.sheet) {
      setOpen(action.sheet);
    }
  };

  return (
    <>
      <div className="flex justify-between px-6 mt-6">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleActionClick(action)}
            className="flex flex-col items-center gap-2 group"
          >
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

      <SendSheet    open={open === "send"}    onClose={() => setOpen(null)} />
      <ReceiveSheet open={open === "receive"} onClose={() => setOpen(null)} />
      <WithdrawSheet
        open={open === "withdraw"}
        onClose={() => { setOpen(null); setScanAddress(""); }}
        initialAddress={scanAddress}
      />
    </>
  );
};

export default ActionButtons;
