CREATE TABLE "PclHomepageRequestDay" (
    "id" TEXT NOT NULL,
    "portalServerId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PclHomepageRequestDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PclHomepageRequestDay_portalServerId_day_key"
ON "PclHomepageRequestDay"("portalServerId", "day");

CREATE INDEX "PclHomepageRequestDay_day_idx" ON "PclHomepageRequestDay"("day");
