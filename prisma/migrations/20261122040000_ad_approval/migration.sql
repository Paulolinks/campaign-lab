-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ad_variant" ADD COLUMN     "approvalAt" TIMESTAMP(3),
ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ad_variant_brandId_approvalStatus_idx" ON "ad_variant"("brandId", "approvalStatus");
