import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import WalletPage from "./WalletPage";
import MarketPage from "./MarketPage";
import HistoryPage from "./HistoryPage";
import EarnPage from "./EarnPage";
import ProfilePage from "./ProfilePage";

const PAGES = [WalletPage, MarketPage, HistoryPage, EarnPage, ProfilePage];

const Index = () => {
  const [activeTab, setActiveTab] = useState(0);
  const Page = PAGES[activeTab];

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <Page />
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
