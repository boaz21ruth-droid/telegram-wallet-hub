import WalletHeader from "@/components/WalletHeader";
import BalanceCard from "@/components/BalanceCard";
import ActionButtons from "@/components/ActionButtons";
import TokenList from "@/components/TokenList";
import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <WalletHeader />
      <BalanceCard />
      <ActionButtons />
      <TokenList />
      <TransactionList />
      <BottomNav />
    </div>
  );
};

export default Index;
