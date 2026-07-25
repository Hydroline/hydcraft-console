ALTER TABLE "DistributionSource"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "DistributionSource_single_default_key"
ON "DistributionSource" ("isDefault")
WHERE "isDefault" = true;
