import WalletHeader from "@/components/WalletHeader";
import BalanceCard from "@/components/BalanceCard";
import ActionButtons from "@/components/ActionButtons";
import TokenList from "@/components/TokenList";
import TransactionList from "@/components/TransactionList";

const WalletPage = () => (
  <>
    <WalletHeader />
    <BalanceCard />
    <ActionButtons />
    <TokenList />
    <TransactionList />
  </>
);

export default WalletPage;
