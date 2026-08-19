import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SyncStatusController } from './sync-status.controller';
import { SyncStatusService } from './sync-status.service';

@Module({
  imports: [AuthModule],
  controllers: [SyncStatusController],
  providers: [SyncStatusService],
  exports: [SyncStatusService],
})
export class SyncModule {}
