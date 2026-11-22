-- CreateEnum
CREATE TYPE "MetaSyncKind" AS ENUM ('FULL', 'INCREMENTAL', 'LEADS');

-- CreateEnum
CREATE TYPE "MetaSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "externalLeadId" TEXT,
ADD COLUMN     "formAnswers" JSONB;

-- AlterTable
ALTER TABLE "published_ad" ADD COLUMN     "effectiveStatus" TEXT,
ADD COLUMN     "externalCreatedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailUrl" TEXT;

-- CreateTable
CREATE TABLE "meta_campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "externalCreatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_set" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "campaignExternalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "optimizationGoal" TEXT,
    "targetingSummary" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "externalCreatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ad_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_period_insight" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "frequency" DOUBLE PRECISION,
    "clicks" INTEGER,
    "linkClicks" INTEGER,
    "leads" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_period_insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_sync_run" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "MetaSyncKind" NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "MetaSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "counts" JSONB,
    "step" TEXT,
    "error" TEXT,
    "retryAfter" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "meta_sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_campaign_brandId_externalId_key" ON "meta_campaign"("brandId", "externalId");

-- CreateIndex
CREATE INDEX "meta_ad_set_brandId_campaignExternalId_idx" ON "meta_ad_set"("brandId", "campaignExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_set_brandId_externalId_key" ON "meta_ad_set"("brandId", "externalId");

-- CreateIndex
CREATE INDEX "meta_period_insight_brandId_level_preset_idx" ON "meta_period_insight"("brandId", "level", "preset");

-- CreateIndex
CREATE UNIQUE INDEX "meta_period_insight_brandId_level_externalId_preset_key" ON "meta_period_insight"("brandId", "level", "externalId", "preset");

-- CreateIndex
CREATE INDEX "meta_sync_run_brandId_kind_startedAt_idx" ON "meta_sync_run"("brandId", "kind", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lead_brandId_externalLeadId_key" ON "lead"("brandId", "externalLeadId");

-- AddForeignKey
ALTER TABLE "meta_campaign" ADD CONSTRAINT "meta_campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_set" ADD CONSTRAINT "meta_ad_set_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_period_insight" ADD CONSTRAINT "meta_period_insight_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_sync_run" ADD CONSTRAINT "meta_sync_run_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

