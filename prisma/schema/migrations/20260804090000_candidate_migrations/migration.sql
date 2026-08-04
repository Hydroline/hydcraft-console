CREATE TYPE "CandidateMigrationState" AS ENUM ('UPLOADING', 'TESTING', 'REVOKING');

ALTER TABLE "ClientMigration"
  ADD COLUMN "candidateState" "CandidateMigrationState",
  ADD COLUMN "candidateRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "candidateEntitlement" TEXT;

CREATE INDEX "ClientMigration_candidateState_fromReleaseId_idx"
  ON "ClientMigration"("candidateState", "fromReleaseId");

CREATE TABLE "ClientMigrationRevision" (
  "id" TEXT NOT NULL,
  "migrationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "packageKey" TEXT NOT NULL,
  "packageSha256" TEXT NOT NULL,
  "packageSize" BIGINT NOT NULL,
  "signature" TEXT NOT NULL,
  "plan" JSONB NOT NULL,
  "anchors" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientMigrationRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientMigrationRevision_migrationId_revision_key"
  ON "ClientMigrationRevision"("migrationId", "revision");
CREATE INDEX "ClientMigrationRevision_migrationId_createdAt_idx"
  ON "ClientMigrationRevision"("migrationId", "createdAt");
ALTER TABLE "ClientMigrationRevision"
  ADD CONSTRAINT "ClientMigrationRevision_migrationId_fkey"
  FOREIGN KEY ("migrationId") REFERENCES "ClientMigration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EntitlementDefinition" ("id", "key", "labels", "updatedAt")
VALUES ('client-test', 'client-test', '{"zh-CN":"客户端测试组","zh-TW":"客戶端測試組","en-US":"Client test group","ja-JP":"クライアントテストグループ"}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
