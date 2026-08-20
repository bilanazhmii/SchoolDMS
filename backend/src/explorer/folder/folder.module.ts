import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../../audit/audit.module';
import { DriveModule } from '../../drive/drive.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { SyncModule } from '../../sync/sync.module';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, DriveModule, StorageModule, SyncModule],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
