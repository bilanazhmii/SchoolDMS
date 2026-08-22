ALTER TABLE "DriveAccount"
ADD COLUMN "oauthStateHash" VARCHAR(128),
ADD COLUMN "oauthStateExpiresAt" TIMESTAMP(3);
