ALTER TABLE "PublishToken" ADD COLUMN "prefix" TEXT NOT NULL;

CREATE UNIQUE INDEX "PublishToken_prefix_key" ON "PublishToken"("prefix");
