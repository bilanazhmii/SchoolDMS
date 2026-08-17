import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../../audit/audit.module';
import { DriveModule } from '../../drive/drive.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [PrismaModule, DriveModule, AuditModule, StorageModule, AuthModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
