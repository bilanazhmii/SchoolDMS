-- Add persistent cursor for Google Drive incremental change tracking.
ALTER TABLE "DriveAccount" ADD COLUMN "driveStartPageToken" TEXT;
