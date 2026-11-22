-- CreateEnum
CREATE TYPE "AdLifecycle" AS ENUM ('TESTING', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('KEEP_LIVE', 'CANCEL', 'STOP');

-- AlterTable
ALTER TABLE "brand" ADD COLUMN     "adDailyBudget" DECIMAL(12,2),
ADD COLUMN     "decisionRules" JSONB,
ADD COLUMN     "maxDailySpend" DECIMAL(12,2),
ADD COLUMN     "targetCostPerAppointment" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "published_ad" ADD COLUMN     "endedAt" DATE,
ADD COLUMN     "lifecycle" "AdLifecycle" NOT NULL DEFAULT 'TESTING',
ADD COLUMN     "liveSince" DATE;

-- CreateTable
CREATE TABLE "ad_decision" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "publishedAdId" TEXT NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "suggested" TEXT NOT NULL,
    "reasons" TEXT[],
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_decision_publishedAdId_decidedAt_idx" ON "ad_decision"("publishedAdId", "decidedAt");

-- CreateIndex
CREATE INDEX "ad_decision_brandId_decidedAt_idx" ON "ad_decision"("brandId", "decidedAt");

-- AddForeignKey
ALTER TABLE "ad_decision" ADD CONSTRAINT "ad_decision_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_decision" ADD CONSTRAINT "ad_decision_publishedAdId_fkey" FOREIGN KEY ("publishedAdId") REFERENCES "published_ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
