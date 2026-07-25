CREATE TABLE "DesktopRefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesktopRefreshToken_tokenHash_key" ON "DesktopRefreshToken"("tokenHash");
CREATE INDEX "DesktopRefreshToken_familyId_idx" ON "DesktopRefreshToken"("familyId");
CREATE INDEX "DesktopRefreshToken_subjectId_expiresAt_idx" ON "DesktopRefreshToken"("subjectId", "expiresAt");

ALTER TABLE "DesktopRefreshToken" ADD CONSTRAINT "DesktopRefreshToken_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "ConsoleSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
