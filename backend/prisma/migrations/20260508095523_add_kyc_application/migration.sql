-- CreateEnum
CREATE TYPE "KycIdType" AS ENUM ('ID_CARD', 'PASSPORT', 'DRIVER_LICENSE');

-- CreateTable
CREATE TABLE "KycApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "idType" "KycIdType" NOT NULL,
    "idNumber" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "frontImagePath" TEXT NOT NULL,
    "backImagePath" TEXT,
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycApplication_userId_key" ON "KycApplication"("userId");

-- CreateIndex
CREATE INDEX "KycApplication_reviewerId_idx" ON "KycApplication"("reviewerId");

-- AddForeignKey
ALTER TABLE "KycApplication" ADD CONSTRAINT "KycApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycApplication" ADD CONSTRAINT "KycApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "AdminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
