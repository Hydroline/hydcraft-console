ALTER TABLE "AddonCategory"
ADD COLUMN "installTarget" TEXT NOT NULL DEFAULT '.',
ADD COLUMN "realDirectory" TEXT;

ALTER TABLE "AddonCategory"
ALTER COLUMN "installTarget" DROP DEFAULT;
