CREATE TABLE "PclHomepage" (
  "id" TEXT NOT NULL,
  "portalServerId" TEXT NOT NULL,
  "xaml" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PclHomepage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PclHomepage_portalServerId_key" ON "PclHomepage"("portalServerId");
