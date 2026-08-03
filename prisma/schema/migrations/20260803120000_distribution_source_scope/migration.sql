CREATE TYPE "DistributionSourceScope" AS ENUM ('CLIENT', 'UPDATER');

ALTER TABLE "DistributionSource"
ADD COLUMN "scope" "DistributionSourceScope" NOT NULL DEFAULT 'CLIENT';
