import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
