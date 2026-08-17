import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Visibility } from '@prisma/client';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) {}

  async search(
    profileId: string,
    query: string,
    filters?: SearchFilters,
    pagination?: SearchPagination,
  ) {
    if (!query || query.trim().length < 2) {
      return { folders: [], files: [], total: 0 };
    }

    const searchTerm = query.trim();
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 50, 100);
    const skip = (page - 1) * limit;

    // Build base where clauses
    const folderWhere: {
      ownerId: string;
      deletedAt: Date | null;
      name: { contains: string; mode: 'insensitive' };
      parentFolderId?: string;
      visibility?: Visibility;
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      ownerId: profileId,
      deletedAt: null,
      name: { contains: searchTerm, mode: 'insensitive' },
    };

    const fileWhere: {
      ownerId: string;
      deletedAt: Date | null;
      name: { contains: string; mode: 'insensitive' };
      folderId?: string;
      mimeType?: { contains: string; mode: 'insensitive' };
      size?: { gte?: bigint; lte?: bigint };
      createdAt?: { gte?: Date; lte?: Date };
      visibility?: Visibility;
    } = {
      ownerId: profileId,
      deletedAt: null,
      name: { contains: searchTerm, mode: 'insensitive' },
    };

    // Apply filters
    if (filters) {
      if (filters.folderId) {
        folderWhere.parentFolderId = filters.folderId;
        fileWhere.folderId = filters.folderId;
      }

      if (filters.mimeType) {
        fileWhere.mimeType = {
          contains: filters.mimeType,
          mode: 'insensitive',
        };
      }

      if (filters.minSize) {
        fileWhere.size = { gte: BigInt(filters.minSize) };
      }

      if (filters.maxSize) {
        fileWhere.size = { ...fileWhere.size, lte: BigInt(filters.maxSize) };
      }

      if (filters.startDate) {
        const baseDateFilter = { gte: new Date(filters.startDate) };
        folderWhere.createdAt = baseDateFilter;
        fileWhere.createdAt = baseDateFilter;
      }

      if (filters.endDate) {
        const baseDateFilter = { lte: new Date(filters.endDate) };
        folderWhere.createdAt = { ...folderWhere.createdAt, ...baseDateFilter };
        fileWhere.createdAt = { ...fileWhere.createdAt, ...baseDateFilter };
      }

      if (filters.visibility) {
        folderWhere.visibility = filters.visibility as Visibility;
        fileWhere.visibility = filters.visibility as Visibility;
      }
    }

    // Execute parallel searches
    const [folders, files, folderCount, fileCount] = await Promise.all([
      this.prisma.folder.findMany({
        where: folderWhere,
        orderBy: { name: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.file.findMany({
        where: fileWhere,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.folder.count({ where: folderWhere }),
      this.prisma.file.count({ where: fileWhere }),
    ]);

    this.logger.log(
      `Search completed for profile ${profileId}: ${folders.length} folders, ${files.length} files`,
    );

    return {
      folders,
      files,
      total: folderCount + fileCount,
      page,
      limit,
      hasMore: folderCount + fileCount > page * limit,
    };
  }
}

export interface SearchFilters {
  folderId?: string;
  mimeType?: string;
  minSize?: number;
  maxSize?: number;
  startDate?: string;
  endDate?: string;
  visibility?: string;
}

export interface SearchPagination {
  page?: number;
  limit?: number;
}
