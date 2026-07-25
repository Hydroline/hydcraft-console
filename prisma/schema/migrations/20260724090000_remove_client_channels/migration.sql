DROP INDEX "ClientRelease_channel_version_key";
DROP INDEX "ClientRelease_channel_status_publishedAt_idx";
DROP INDEX "ClientMigration_channel_fromReleaseId_toReleaseId_key";
DROP INDEX "ClientMigration_channel_status_fromReleaseId_publishedAt_idx";

ALTER TABLE "ClientRelease" DROP COLUMN "channel";
ALTER TABLE "ClientMigration" DROP COLUMN "channel";

CREATE UNIQUE INDEX "ClientRelease_version_key" ON "ClientRelease"("version");
CREATE INDEX "ClientRelease_status_publishedAt_idx" ON "ClientRelease"("status", "publishedAt");
CREATE UNIQUE INDEX "ClientMigration_fromReleaseId_toReleaseId_key" ON "ClientMigration"("fromReleaseId", "toReleaseId");
CREATE INDEX "ClientMigration_status_fromReleaseId_publishedAt_idx" ON "ClientMigration"("status", "fromReleaseId", "publishedAt");
