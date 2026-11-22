-- CreateTable
CREATE TABLE "meta_connection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "tokenLast4" TEXT NOT NULL,
    "appSecretEncrypted" TEXT,
    "adAccountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "savedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_connection_brandId_key" ON "meta_connection"("brandId");

-- AddForeignKey
ALTER TABLE "meta_connection" ADD CONSTRAINT "meta_connection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

