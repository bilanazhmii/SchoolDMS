import type { Response } from 'express';

import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriveService } from './drive.service';

@ApiTags('drive')
@ApiBearerAuth()
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  connect(@CurrentUser() user: AuthenticatedProfile, @Res() res: Response) {
    const url = this.driveService.getAuthUrl(user);
    return res.redirect(url);
  }

  @Get('callback')
  @ApiOkResponse({ description: 'OAuth2 callback for Google Drive' })
  async callback(@Query('code') code: string, @Query('state') state: string) {
    if (!code || !state)
      return { success: false, message: 'Missing code or state' };
    return this.driveService.handleOAuthCallback(code, state);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOkResponse({ description: 'Verify Drive connection for current user' })
  async status(@CurrentUser() user: AuthenticatedProfile) {
    return this.driveService.verifyConnection(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  @ApiOkResponse({ description: 'Disconnect Google Drive for current user' })
  async disconnect(@CurrentUser() user: AuthenticatedProfile) {
    return this.driveService.disconnect(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('account')
  @ApiOkResponse({ description: 'Get saved Drive account information' })
  async account(@CurrentUser() user: AuthenticatedProfile) {
    return this.driveService.getDriveAccountInfo(user.id);
  }
}
