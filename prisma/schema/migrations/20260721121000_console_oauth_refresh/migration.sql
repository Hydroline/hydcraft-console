ALTER TABLE "ConsoleSession" ADD COLUMN "portalAccessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "ConsoleSession" ADD COLUMN "portalRefreshToken" TEXT;
ALTER TABLE "ConsoleSession" ADD COLUMN "portalRefreshTokenExpiresAt" TIMESTAMP(3);
