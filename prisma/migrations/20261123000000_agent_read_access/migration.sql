-- AlterTable
ALTER TABLE "published_ad" ADD COLUMN     "creative" JSONB;

-- CreateTable
CREATE TABLE "agent_access_key" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "agent_access_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_access_key_keyHash_key" ON "agent_access_key"("keyHash");

-- CreateIndex
CREATE INDEX "agent_access_key_workspaceId_idx" ON "agent_access_key"("workspaceId");

-- AddForeignKey
ALTER TABLE "agent_access_key" ADD CONSTRAINT "agent_access_key_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

