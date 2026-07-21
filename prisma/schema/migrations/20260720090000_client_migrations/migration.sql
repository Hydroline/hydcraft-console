CREATE TYPE "ClientReleaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "ClientRelease" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "status" "ClientReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientRelease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientRelease_channel_version_key" ON "ClientRelease"("channel", "version");
CREATE INDEX "ClientRelease_channel_status_publishedAt_idx" ON "ClientRelease"("channel", "status", "publishedAt");

CREATE TABLE "ClientMigration" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "fromReleaseId" TEXT NOT NULL,
  "toReleaseId" TEXT NOT NULL,
  "packageKey" TEXT NOT NULL,
  "packageSha256" TEXT NOT NULL,
  "packageSize" BIGINT NOT NULL,
  "signature" TEXT NOT NULL,
  "plan" JSONB NOT NULL,
  "anchors" JSONB NOT NULL,
  "status" "ClientReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientMigration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientMigration_channel_fromReleaseId_toReleaseId_key" ON "ClientMigration"("channel", "fromReleaseId", "toReleaseId");
CREATE INDEX "ClientMigration_channel_status_fromReleaseId_publishedAt_idx" ON "ClientMigration"("channel", "status", "fromReleaseId", "publishedAt");
ALTER TABLE "ClientMigration" ADD CONSTRAINT "ClientMigration_fromReleaseId_fkey" FOREIGN KEY ("fromReleaseId") REFERENCES "ClientRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientMigration" ADD CONSTRAINT "ClientMigration_toReleaseId_fkey" FOREIGN KEY ("toReleaseId") REFERENCES "ClientRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
