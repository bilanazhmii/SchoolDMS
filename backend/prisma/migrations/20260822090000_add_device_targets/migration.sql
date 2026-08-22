-- CreateTable
CREATE TABLE "DeviceTarget" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "relativeRoot" VARCHAR(255) NOT NULL,
    "localPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTarget_deviceId_relativeRoot_key" ON "DeviceTarget"("deviceId", "relativeRoot");
CREATE INDEX "DeviceTarget_profileId_active_idx" ON "DeviceTarget"("profileId", "active");
CREATE INDEX "DeviceTarget_deviceId_active_idx" ON "DeviceTarget"("deviceId", "active");

-- AddForeignKey
ALTER TABLE "DeviceTarget" ADD CONSTRAINT "DeviceTarget_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceTarget" ADD CONSTRAINT "DeviceTarget_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
