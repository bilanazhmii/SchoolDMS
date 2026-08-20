import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto';
import { FolderService } from './folder.service';

@ApiTags('folders')
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FolderController {
  constructor(private service: FolderService) {}

  @Get('root/contents')
  @ApiOperation({ summary: 'List root contents: folders and files' })
  async rootContents(
    @CurrentUser() user: AuthenticatedProfile,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 50;
    return {
      success: true,
      data: await this.service.getContents(user.id, undefined, p, l),
    };
  }

  @Get('root')
  @ApiOperation({ summary: 'List root folders for current user' })
  async root(@CurrentUser() user: AuthenticatedProfile) {
    return { success: true, data: await this.service.rootFolders(user.id) };
  }

  @Get(':id/contents')
  @ApiOperation({ summary: 'Get folder contents: folders and files' })
  async contents(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 50;
    return {
      success: true,
      data: await this.service.getContents(user.id, id, p, l),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create folder' })
  async create(
    @CurrentUser() user: AuthenticatedProfile,
    @Body() dto: CreateFolderDto,
  ) {
    return { success: true, data: await this.service.create(user.id, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update folder' })
  async update(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return { success: true, data: await this.service.update(user.id, id, dto) };
  }

  @Post(':id/copy')
  @ApiOperation({ summary: 'Copy folder recursively' })
  async copy(@CurrentUser() user: AuthenticatedProfile, @Param('id') id: string) {
    return { success: true, data: await this.service.copy(user.id, id) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (soft) folder' })
  async remove(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.softDelete(user.id, id) };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore folder from trash' })
  async restore(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.restore(user.id, id) };
  }
}
