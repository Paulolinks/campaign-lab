-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'EDITOR', 'SALES', 'VIEWER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('META', 'FACEBOOK_ORGANIC', 'INSTAGRAM_ORGANIC', 'GOOGLE_ADS', 'GOOGLE_BUSINESS_PROFILE', 'TIKTOK', 'YOUTUBE', 'NEXTDOOR', 'MARKETPLACE', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DISCONNECTED', 'CONFIGURING', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'READY', 'TESTING', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestLabel" AS ENUM ('TESTING', 'INSUFFICIENT_DATA', 'BEST_QUALITY_PROVISIONAL', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'GOOGLE_DRIVE');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('STORED', 'UPLOAD_PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('MANUAL', 'CSV', 'META_API', 'GOOGLE_ADS_API');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_COMPLETED', 'ESTIMATE_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "AttributionConfidence" AS ENUM ('CONFIRMED', 'PROBABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_member" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "domain" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "serviceArea" TEXT,
    "forbiddenTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_version" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_account" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_plan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "personaVersionId" TEXT,
    "service" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "channels" TEXT[],
    "landingUrl" TEXT NOT NULL,
    "market" TEXT,
    "testVariable" TEXT,
    "ctaDestination" TEXT,
    "budgetPerDay" DECIMAL(12,2),
    "budgetNote" TEXT,
    "notes" TEXT,
    "extra" JSONB,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_variant" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adKey" TEXT NOT NULL,
    "name" TEXT,
    "angle" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "funnelStage" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT NOT NULL,
    "visualDirection" TEXT NOT NULL,
    "imagePrompt" TEXT,
    "videoScript" TEXT,
    "notes" TEXT,
    "creativeStatus" TEXT,
    "extra" JSONB,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "testLabel" "TestLabel",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_variant_version" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "importBatchId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_variant_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "summary" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "variantId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "driveFileId" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'STORED',
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_ad" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "variantId" TEXT,
    "channelAccountId" TEXT,
    "platform" "Platform" NOT NULL,
    "externalAdId" TEXT NOT NULL,
    "externalCampaignId" TEXT,
    "externalAdSetId" TEXT,
    "name" TEXT,
    "placement" TEXT,
    "externalStatus" TEXT,
    "url" TEXT,
    "utmUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_ad_insight" (
    "id" TEXT NOT NULL,
    "publishedAdId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "MetricSource" NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "linkClicks" INTEGER,
    "clicks" INTEGER,
    "platformLeads" INTEGER,
    "actions" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_ad_insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "requestedService" TEXT,
    "zip" TEXT,
    "urgency" TEXT,
    "primaryPriority" TEXT,
    "reasonLost" TEXT,
    "notes" TEXT,
    "sourcePlatform" "Platform",
    "sourceConfidence" "AttributionConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "campaignId" TEXT,
    "variantId" TEXT,
    "publishedAdId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_change" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "from" "LeadStatus",
    "to" "LeadStatus" NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimateId" TEXT,
    "contractAmount" DECIMAL(12,2) NOT NULL,
    "directCosts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "workspace_member_userId_idx" ON "workspace_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_member_workspaceId_userId_key" ON "workspace_member"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "audit_log_workspaceId_createdAt_idx" ON "audit_log"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_workspaceId_slug_key" ON "brand"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "persona_version_brandId_name_version_key" ON "persona_version"("brandId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "channel_account_brandId_platform_externalAccountId_key" ON "channel_account"("brandId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "campaign_plan_brandId_status_idx" ON "campaign_plan"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_plan_brandId_campaignKey_key" ON "campaign_plan"("brandId", "campaignKey");

-- CreateIndex
CREATE INDEX "ad_variant_campaignId_idx" ON "ad_variant"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_variant_brandId_adKey_key" ON "ad_variant"("brandId", "adKey");

-- CreateIndex
CREATE UNIQUE INDEX "ad_variant_version_variantId_version_key" ON "ad_variant_version"("variantId", "version");

-- CreateIndex
CREATE INDEX "import_batch_brandId_createdAt_idx" ON "import_batch"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "media_asset_brandId_createdAt_idx" ON "media_asset"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "media_asset_variantId_idx" ON "media_asset"("variantId");

-- CreateIndex
CREATE INDEX "published_ad_variantId_idx" ON "published_ad"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "published_ad_brandId_platform_externalAdId_key" ON "published_ad"("brandId", "platform", "externalAdId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_ad_insight_publishedAdId_date_source_key" ON "daily_ad_insight"("publishedAdId", "date", "source");

-- CreateIndex
CREATE INDEX "lead_brandId_createdAt_idx" ON "lead"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_brandId_status_idx" ON "lead"("brandId", "status");

-- CreateIndex
CREATE INDEX "lead_status_change_leadId_idx" ON "lead_status_change"("leadId");

-- CreateIndex
CREATE INDEX "estimate_leadId_idx" ON "estimate"("leadId");

-- CreateIndex
CREATE INDEX "job_leadId_idx" ON "job"("leadId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member" ADD CONSTRAINT "workspace_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_version" ADD CONSTRAINT "persona_version_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_account" ADD CONSTRAINT "channel_account_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_plan" ADD CONSTRAINT "campaign_plan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_plan" ADD CONSTRAINT "campaign_plan_personaVersionId_fkey" FOREIGN KEY ("personaVersionId") REFERENCES "persona_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_variant" ADD CONSTRAINT "ad_variant_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_variant" ADD CONSTRAINT "ad_variant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_variant_version" ADD CONSTRAINT "ad_variant_version_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ad_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_variant_version" ADD CONSTRAINT "ad_variant_version_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ad_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_ad" ADD CONSTRAINT "published_ad_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_ad" ADD CONSTRAINT "published_ad_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ad_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_ad" ADD CONSTRAINT "published_ad_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_ad_insight" ADD CONSTRAINT "daily_ad_insight_publishedAdId_fkey" FOREIGN KEY ("publishedAdId") REFERENCES "published_ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ad_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_publishedAdId_fkey" FOREIGN KEY ("publishedAdId") REFERENCES "published_ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_change" ADD CONSTRAINT "lead_status_change_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
