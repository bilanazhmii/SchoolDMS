CREATE TABLE "RemoteChange" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "fileId" UUID,
    "folderId" UUID,
    "relativePath" TEXT,
    "oldRelativePath" TEXT,
    "name" VARCHAR(255),
    "mimeType" VARCHAR(255),
    "size" BIGINT,
    "sha256" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RemoteChange_profileId_createdAt_idx" ON "RemoteChange"("profileId", "createdAt");
CREATE INDEX "RemoteChange_fileId_idx" ON "RemoteChange"("fileId");
CREATE INDEX "RemoteChange_folderId_idx" ON "RemoteChange"("folderId");

ALTER TABLE "RemoteChange" ADD CONSTRAINT "RemoteChange_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
