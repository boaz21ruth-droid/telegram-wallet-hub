-- AlterTable: add lastScannedLt to WalletAddress
ALTER TABLE "WalletAddress" ADD COLUMN "lastScannedLt" TEXT NOT NULL DEFAULT '0';

-- CreateIndex: unique txHash on DepositOrder
CREATE UNIQUE INDEX "DepositOrder_txHash_key" ON "DepositOrder"("txHash");
