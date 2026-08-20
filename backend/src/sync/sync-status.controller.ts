import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { HeartbeatDto, SyncJobReportDto } from './sync-status.service';
import { SyncStatusService } from './sync-status.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncStatusController {
  constructor(private readonly sync: SyncStatusService) {}

  @Post('heartbeat')
  heartbeat(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: HeartbeatDto,
  ) {
    return { success: true, data: this.sync.heartbeat(user.id, dto) };
  }

  @Post('jobs')
  reportJob(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: SyncJobReportDto,
  ) {
    return { success: true, data: this.sync.reportJob(user.id, dto) };
  }

  @Get('changes')
  changes(
    @CurrentUser() user: AuthenticatedProfile,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return { success: true, data: this.sync.getRemoteChanges(user.id, since, limit ? Number(limit) : 200) };
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedProfile) {
    return { success: true, data: this.sync.status(user.id) };
  }
}
