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
  async heartbeat(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: HeartbeatDto,
  ) {
    return { success: true, data: await this.sync.heartbeat(user.id, dto) };
  }

  @Post('jobs')
  async reportJob(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: SyncJobReportDto,
  ) {
    return { success: true, data: await this.sync.reportJob(user.id, dto) };
  }

  @Get('changes')
  async changes(
    @CurrentUser() user: AuthenticatedProfile,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ) {
    return { success: true, data: await this.sync.getRemoteChanges(user.id, since, limit ? Number(limit) : 200, deviceIdentifier) };
  }

  @Get('status')
    async status(@CurrentUser() user: AuthenticatedProfile) {
    return { success: true, data: await this.sync.status(user.id) };
  }

}
