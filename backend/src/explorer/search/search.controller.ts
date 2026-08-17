import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  SearchService,
  SearchFilters,
  SearchPagination,
} from './search.service';

@ApiTags('search')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search folders and files' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'folderId',
    required: false,
    description: 'Filter by folder ID',
  })
  @ApiQuery({
    name: 'mimeType',
    required: false,
    description: 'Filter by MIME type',
  })
  @ApiQuery({
    name: 'minSize',
    required: false,
    description: 'Minimum file size in bytes',
  })
  @ApiQuery({
    name: 'maxSize',
    required: false,
    description: 'Maximum file size in bytes',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO string)',
  })
  @ApiQuery({
    name: 'visibility',
    required: false,
    description: 'Filter by visibility',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page' })
  async search(
    @CurrentUser() user: AuthenticatedProfile,
    @Query('q') query: string,
    @Query('folderId') folderId?: string,
    @Query('mimeType') mimeType?: string,
    @Query('minSize') minSize?: string,
    @Query('maxSize') maxSize?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('visibility') visibility?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: SearchFilters = {};
    if (folderId) filters.folderId = folderId;
    if (mimeType) filters.mimeType = mimeType;
    if (minSize) filters.minSize = parseInt(minSize, 10);
    if (maxSize) filters.maxSize = parseInt(maxSize, 10);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (visibility) filters.visibility = visibility;

    const pagination: SearchPagination = {};
    if (page) pagination.page = parseInt(page, 10);
    if (limit) pagination.limit = parseInt(limit, 10);

    return {
      success: true,
      data: await this.searchService.search(
        user.id,
        query,
        filters,
        pagination,
      ),
    };
  }
}
