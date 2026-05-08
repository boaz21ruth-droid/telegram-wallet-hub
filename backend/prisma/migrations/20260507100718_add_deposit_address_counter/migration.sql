-- CreateTable
CREATE TABLE "DepositAddressCounter" (
    "id" TEXT NOT NULL,
    "nextIndex" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DepositAddressCounter_pkey" PRIMARY KEY ("id")
);
