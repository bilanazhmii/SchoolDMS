ALTER TABLE "Folder" ADD COLUMN "canonicalKey" VARCHAR(255);

CREATE UNIQUE INDEX "Folder_canonicalKey_key" ON "Folder"("canonicalKey");
