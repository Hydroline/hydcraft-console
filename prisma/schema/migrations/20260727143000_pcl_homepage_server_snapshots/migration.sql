CREATE TABLE "PclHomepageServerSnapshot" (
    "portalServerId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "nameZhCn" TEXT NOT NULL,
    "nameZhTw" TEXT NOT NULL,
    "nameEnUs" TEXT NOT NULL,
    "nameJaJp" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PclHomepageServerSnapshot_pkey" PRIMARY KEY ("portalServerId")
);

INSERT INTO "PclHomepageServerSnapshot" (
    "portalServerId", "serverId", "code", "shortCode", "nameZhCn", "nameZhTw", "nameEnUs", "nameJaJp", "status", "lastSeenAt", "createdAt", "updatedAt"
)
SELECT
    "portalServerId", "portalServerId", "portalServerId", "portalServerId", "portalServerId", "portalServerId", "portalServerId", "portalServerId", 'UNKNOWN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PclHomepage"
ON CONFLICT ("portalServerId") DO NOTHING;

CREATE INDEX "PclHomepageServerSnapshot_serverId_idx" ON "PclHomepageServerSnapshot"("serverId");
CREATE INDEX "PclHomepageServerSnapshot_code_idx" ON "PclHomepageServerSnapshot"("code");
CREATE INDEX "PclHomepageServerSnapshot_shortCode_idx" ON "PclHomepageServerSnapshot"("shortCode");
CREATE INDEX "PclHomepageServerSnapshot_missingAt_idx" ON "PclHomepageServerSnapshot"("missingAt");
