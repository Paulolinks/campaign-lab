-- AlterTable
ALTER TABLE "campaign_plan" ADD COLUMN     "tasksDone" TEXT[] DEFAULT ARRAY[]::TEXT[];

