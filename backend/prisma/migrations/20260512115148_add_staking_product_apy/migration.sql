-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FiatOnrampStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StakingProductType" AS ENUM ('FLEXIBLE', 'FIXED');

-- CreateEnum
CREATE TYPE "StakingOrderStatus" AS ENUM ('ACTIVE', 'REDEEMING', 'REDEEMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalType" ADD VALUE 'SWAP';
ALTER TYPE "JournalType" ADD VALUE 'FIAT_ONRAMP';
ALTER TYPE "JournalType" ADD VALUE 'STAKING_LOCK';
ALTER TYPE "JournalType" ADD VALUE 'STAKING_UNLOCK';
ALTER TYPE "JournalType" ADD VALUE 'STAKING_YIELD';

-- AlterTable
ALTER TABLE "WalletAccount" ADD COLUMN     "stakedBalance" DECIMAL(36,18) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SwapOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAssetCode" TEXT NOT NULL,
    "fromNetwork" TEXT NOT NULL,
    "fromAmount" DECIMAL(36,18) NOT NULL,
    "toAssetCode" TEXT NOT NULL,
    "toNetwork" TEXT NOT NULL,
    "toAmount" DECIMAL(36,18) NOT NULL,
    "midRate" DECIMAL(36,18) NOT NULL,
    "feeRate" DECIMAL(36,18) NOT NULL,
    "feeAmount" DECIMAL(36,18) NOT NULL,
    "bizNo" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'COMPLETED',
    "journalId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiatOnrampOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "fiatAmount" DECIMAL(36,6) NOT NULL,
    "assetCode" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "cryptoAmount" DECIMAL(36,18) NOT NULL,
    "grossAmount" DECIMAL(36,18) NOT NULL,
    "feeAmount" DECIMAL(36,18) NOT NULL,
    "exchangeRate" DECIMAL(36,6) NOT NULL,
    "feeRate" DECIMAL(36,6) NOT NULL,
    "paymentMethodCode" TEXT,
    "paymentAccountRef" TEXT,
    "paymentProofPath" TEXT,
    "paymentNote" TEXT,
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "status" "FiatOnrampStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "journalId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiatOnrampOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiatPaymentMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "qrCodePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiatPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakingProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetCode" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "productType" "StakingProductType" NOT NULL,
    "minAmount" DECIMAL(36,18) NOT NULL,
    "maxAmount" DECIMAL(36,18),
    "totalCap" DECIMAL(36,18),
    "lockDays" INTEGER NOT NULL DEFAULT 0,
    "currentApy" DECIMAL(10,6) NOT NULL DEFAULT 0.042,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakingOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "principal" DECIMAL(36,18) NOT NULL,
    "accruedYield" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "lastYieldAt" TIMESTAMP(3),
    "nextYieldAt" TIMESTAMP(3),
    "maturesAt" TIMESTAMP(3),
    "redeemRequestedAt" TIMESTAMP(3),
    "status" "StakingOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "lockJournalId" TEXT,
    "unlockJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakingYieldRecord" (
    "id" TEXT NOT NULL,
    "stakingOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "grossYield" DECIMAL(36,18) NOT NULL,
    "platformFee" DECIMAL(36,18) NOT NULL,
    "netYield" DECIMAL(36,18) NOT NULL,
    "journalId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakingYieldRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SwapOrder_journalId_key" ON "SwapOrder"("journalId");

-- CreateIndex
CREATE INDEX "SwapOrder_userId_createdAt_idx" ON "SwapOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SwapOrder_status_idx" ON "SwapOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SwapOrder_userId_bizNo_key" ON "SwapOrder"("userId", "bizNo");

-- CreateIndex
CREATE UNIQUE INDEX "FiatOnrampOrder_journalId_key" ON "FiatOnrampOrder"("journalId");

-- CreateIndex
CREATE INDEX "FiatOnrampOrder_userId_createdAt_idx" ON "FiatOnrampOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FiatOnrampOrder_status_idx" ON "FiatOnrampOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FiatPaymentMethod_code_key" ON "FiatPaymentMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StakingOrder_lockJournalId_key" ON "StakingOrder"("lockJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "StakingOrder_unlockJournalId_key" ON "StakingOrder"("unlockJournalId");

-- CreateIndex
CREATE INDEX "StakingOrder_userId_status_idx" ON "StakingOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "StakingOrder_status_nextYieldAt_idx" ON "StakingOrder"("status", "nextYieldAt");

-- CreateIndex
CREATE UNIQUE INDEX "StakingYieldRecord_journalId_key" ON "StakingYieldRecord"("journalId");

-- CreateIndex
CREATE INDEX "StakingYieldRecord_stakingOrderId_idx" ON "StakingYieldRecord"("stakingOrderId");

-- AddForeignKey
ALTER TABLE "SwapOrder" ADD CONSTRAINT "SwapOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiatOnrampOrder" ADD CONSTRAINT "FiatOnrampOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiatOnrampOrder" ADD CONSTRAINT "FiatOnrampOrder_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakingOrder" ADD CONSTRAINT "StakingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakingOrder" ADD CONSTRAINT "StakingOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StakingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakingYieldRecord" ADD CONSTRAINT "StakingYieldRecord_stakingOrderId_fkey" FOREIGN KEY ("stakingOrderId") REFERENCES "StakingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
