import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SyncModule } from '../sync/sync.module';
import { DriveController } from './drive.controller';
import { DriveDedupeService } from './drive-dedupe.service';
import { DriveService } from './drive.service';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, SyncModule],
  controllers: [DriveController],
  providers: [DriveService, DriveDedupeService],
  exports: [DriveService],
})
export class DriveModule {}
