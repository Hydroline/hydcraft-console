-- CreateEnum
CREATE TYPE "ReleaseKind" AS ENUM ('CLIENT', 'UPDATER');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'PUBLISHED', 'REVOKED', 'LOGGED_OUT');

-- CreateTable
CREATE TABLE "EntitlementDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "description" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectEntitlement" (
    "subjectId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectEntitlement_pkey" PRIMARY KEY ("subjectId","entitlementId")
);

-- CreateTable
CREATE TABLE "DistributionSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "policy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddonCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "description" JSONB,
    "entitlementMode" "AccessMode" NOT NULL DEFAULT 'ANY',
    "entitlements" TEXT[],
    "sourceIds" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostCommitEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostCommitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsoleSubject" (
    "id" TEXT NOT NULL,
    "hydrolineId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsoleSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsoleSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "portalAccessToken" TEXT,
    "subjectId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsoleSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcLoginAttempt" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "returnTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRevision" (
    "id" TEXT NOT NULL,
    "kind" "ReleaseKind" NOT NULL,
    "version" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "manifest" JSONB NOT NULL,
    "signature" JSONB,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" "ReleaseKind"[],
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolePolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "edgeOne" JSONB,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementDefinition_key_key" ON "EntitlementDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionSource_key_key" ON "DistributionSource"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AddonCategory_key_key" ON "AddonCategory"("key");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "PostCommitEvent_dispatchedAt_createdAt_idx" ON "PostCommitEvent"("dispatchedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsoleSubject_hydrolineId_key" ON "ConsoleSubject"("hydrolineId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsoleSession_tokenHash_key" ON "ConsoleSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ConsoleSession_subjectId_expiresAt_idx" ON "ConsoleSession"("subjectId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OidcLoginAttempt_stateHash_key" ON "OidcLoginAttempt"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthorizationCode_codeHash_key" ON "DesktopAuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "ReleaseRevision_kind_status_publishedAt_idx" ON "ReleaseRevision"("kind", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseRevision_kind_version_revision_key" ON "ReleaseRevision"("kind", "version", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PublishToken_tokenHash_key" ON "PublishToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "SubjectEntitlement" ADD CONSTRAINT "SubjectEntitlement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "ConsoleSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectEntitlement" ADD CONSTRAINT "SubjectEntitlement_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "EntitlementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "ConsoleSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleSession" ADD CONSTRAINT "ConsoleSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "ConsoleSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
