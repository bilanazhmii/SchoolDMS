import crypto from 'crypto';

import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { IStorageService } from '../storage/storage.service.interface';
import { STORAGE_SERVICE_TOKEN } from '../storage/storage.module';
import { SharePermission } from '@prisma/client';

export interface CreateShareLinkDto {
  fileId?: string;
  folderId?: string;
  permission?: SharePermission;
  expiresAt?: string;
  downloadLimit?: number;
}

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService,
  ) {}

  async create(profileId: string, dto: CreateShareLinkDto) {
    if (!dto.fileId && !dto.folderId) {
      throw new BadRequestException('fileId or folderId is required');
    }

    if (dto.fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: dto.fileId },
      });
      if (!file || file.ownerId !== profileId || file.deletedAt) {
        throw new NotFoundException('File not found');
      }
    }

    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: dto.folderId },
      });
      if (!folder || folder.ownerId !== profileId || folder.deletedAt) {
        throw new NotFoundException('Folder not found');
      }
    }

    const publicToken = crypto.randomBytes(16).toString('base64url');

    const link = await this.prisma.shareLink.create({
      data: {
        publicToken,
        fileId: dto.fileId ?? null,
        folderId: dto.folderId ?? null,
        permission: dto.permission ?? SharePermission.VIEW,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        downloadLimit: dto.downloadLimit ?? 0,
        createdById: profileId,
      },
    });

    await this.audit.log(profileId, 'SHARE', dto.fileId ? 'FILE' : 'FOLDER', dto.fileId ?? dto.folderId ?? null, {
      publicToken,
      permission: link.permission,
    });

    return link;
  }

  async remove(profileId: string, id: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { id } });
    if (!link || link.createdById !== profileId) {
      throw new NotFoundException('Share link not found');
    }
    await this.prisma.shareLink.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  }

  async listForProfile(profileId: string) {
    return this.prisma.shareLink.findMany({
      where: { createdById: profileId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async resolveActiveLink(publicToken: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { publicToken },
    });
    if (!link || !link.isActive) {
      throw new NotFoundException('Link not found');
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('Link expired');
    }
    return link;
  }

  async getPublic(publicToken: string) {
    const link = await this.resolveActiveLink(publicToken);

    if (link.fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: link.fileId },
      });
      if (!file || file.deletedAt) throw new NotFoundException('File not found');
      return {
        type: 'file',
        permission: link.permission,
        expiresAt: link.expiresAt,
        downloadLimit: link.downloadLimit,
        downloadCount: link.downloadCount,
        file: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: Number(file.size),
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      };
    }

    if (link.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: link.folderId },
      });
      if (!folder || folder.deletedAt)
        throw new NotFoundException('Folder not found');
      const files = await this.prisma.file.findMany({
        where: { folderId: folder.id, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, mimeType: true, size: true, updatedAt: true },
      });
      return {
        type: 'folder',
        permission: link.permission,
        expiresAt: link.expiresAt,
        folder: {
          id: folder.id,
          name: folder.name,
          files: files.length,
          items: files.map((file) => ({ ...file, size: Number(file.size) })),
        },
      };
    }

    throw new NotFoundException('Link has no target');
  }

  async downloadPublic(publicToken: string, res: Response, requestedFileId?: string) {
    const link = await this.resolveActiveLink(publicToken);

    if (link.permission !== SharePermission.DOWNLOAD && link.permission !== SharePermission.EDIT && link.permission !== SharePermission.VIEW) {
      // VIEW-only links may still allow download when downloadLimit is configured; otherwise block.
      if (link.downloadLimit === 0) {
        throw new ForbiddenException('This link does not allow downloads');
      }
    }

    if (link.downloadLimit !== null && link.downloadLimit > 0 && link.downloadCount >= link.downloadLimit) {
      throw new ForbiddenException('Download limit reached');
    }

    const targetFileId = link.fileId ?? requestedFileId;
    const file = targetFileId
      ? await this.prisma.file.findUnique({ where: { id: targetFileId } })
      : null;

    if (link.folderId && (!requestedFileId || !file || file.folderId !== link.folderId)) {
      throw new NotFoundException('Shared file is not inside this folder');
    }
    if (!file || file.deletedAt) throw new NotFoundException('File not found');

    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: file.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (!latestVersion?.storagePath) {
      throw new NotFoundException('File version not found');
    }

    const buffer = await this.storage.download(latestVersion.storagePath);

    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: { downloadCount: { increment: 1 } },
    });

    const fileName = encodeURIComponent(file.name);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }
}
