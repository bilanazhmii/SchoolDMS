import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CreateShareLinkDto } from './sharing.service';
import { SharingService } from './sharing.service';

@ApiTags('sharing')
@Controller()
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('share-links')
  async create(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: CreateShareLinkDto,
  ) {
    return { success: true, data: await this.sharing.create(user.id, dto) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('share-links')
  async list(@CurrentUser() user: AuthenticatedProfile) {
    return { success: true, data: await this.sharing.listForProfile(user.id) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('share-links/:id')
  async remove(@CurrentUser() user: AuthenticatedProfile, @Param('id') id: string) {
    return { success: true, data: await this.sharing.remove(user.id, id) };
  }

  // Public endpoints — intentionally WITHOUT JwtAuthGuard.
  @Get('share/:token')
  async getPublic(@Param('token') token: string) {
    return { success: true, data: await this.sharing.getPublic(token) };
  }

  @Get('share/:token/contents')
  async getPublicFolderContents(@Param('token') token: string) {
    return { success: true, data: await this.sharing.getPublicFolderContents(token) };
  }

  @Get('share/:token/contents/:folderId')
  async getPublicSubfolderContents(
    @Param('token') token: string,
    @Param('folderId') folderId: string,
  ) {
    return { success: true, data: await this.sharing.getPublicFolderContents(token, folderId) };
  }

  @Post('share/:token/content')
  async updatePublicContent(
    @Param('token') token: string,
    @Body() body: { content?: string; fileId?: string },
  ) {
    return { success: true, data: await this.sharing.updatePublicText(token, body.content ?? '', body.fileId) };
  }

  @Get('share/:token/preview')
  previewPublic(@Param('token') token: string, @Res() res: Response) {
    return this.sharing.previewPublic(token, res);
  }

  @Get('share/:token/preview/:fileId')
  previewPublicFolderFile(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    return this.sharing.previewPublic(token, res, fileId);
  }

  @Get('share/:token/download')
  downloadPublic(@Param('token') token: string, @Res() res: Response) {
    return this.sharing.downloadPublic(token, res);
  }

  @Get('share/:token/download/:fileId')
  downloadPublicFolderFile(
    @Param('token') token: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    return this.sharing.downloadPublic(token, res, fileId);
  }
}
