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
import { DriveService } from '../drive/drive.service';
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
  description?: string;
}

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly drive: DriveService,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService,
  ) {}

  async create(profileId: string, dto: CreateShareLinkDto) {
    if ((!dto.fileId && !dto.folderId) || (dto.fileId && dto.folderId)) {
      throw new BadRequestException('Exactly one of fileId or folderId is required');
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

    const existing = await this.prisma.shareLink.findFirst({
      where: {
        createdById: profileId,
        isActive: true,
        ...(dto.fileId ? { fileId: dto.fileId, folderId: null } : { folderId: dto.folderId, fileId: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const targetWhere = dto.fileId
        ? { fileId: dto.fileId, folderId: null }
        : { folderId: dto.folderId, fileId: null };
      await this.prisma.shareLink.updateMany({
        where: { createdById: profileId, isActive: true, ...targetWhere, id: { not: existing.id } },
        data: { isActive: false },
      });
      return this.prisma.shareLink.update({
        where: { id: existing.id },
        data: {
          permission: dto.permission ?? existing.permission,
          description: dto.description?.trim() || null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          downloadLimit: dto.downloadLimit ?? existing.downloadLimit,
          downloadCount: 0,
        },
      });
    }

    const publicToken = crypto.randomBytes(24).toString('base64url');

    const link = await this.prisma.shareLink.create({
      data: {
        publicToken,
        fileId: dto.fileId ?? null,
        folderId: dto.folderId ?? null,
        permission: dto.permission ?? SharePermission.VIEW,
        description: dto.description?.trim() || null,
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

  private async resolvePublicFolder(publicToken: string, requestedFolderId?: string) {
    const link = await this.resolveActiveLink(publicToken);
    if (!link.folderId) throw new NotFoundException('Link does not target a folder');

    const root = await this.prisma.folder.findUnique({ where: { id: link.folderId } });
    if (!root || root.deletedAt) throw new NotFoundException('Folder not found');

    const folder = requestedFolderId
      ? await this.prisma.folder.findUnique({ where: { id: requestedFolderId } })
      : root;
    if (!folder || folder.ownerId !== root.ownerId || folder.deletedAt) {
      throw new NotFoundException('Folder not found');
    }
    const isRoot = folder.id === root.id;
    const isDescendant = folder.relativePath.startsWith(`${root.relativePath}/`);
    if (!isRoot && !isDescendant) {
      throw new NotFoundException('Folder is not inside the shared folder');
    }

    return { link, root, folder };
  }

  private async assertPublicFileAccess(link: Awaited<ReturnType<SharingService['resolveActiveLink']>>, file: { ownerId: string; deletedAt: Date | null; relativePath: string; folderId: string | null }) {
    if (!link.folderId) return;
    const root = await this.prisma.folder.findUnique({ where: { id: link.folderId } });
    if (!root || root.deletedAt || file.ownerId !== root.ownerId) {
      throw new NotFoundException('Shared file is not inside this folder');
    }
    if (file.relativePath.startsWith(`${root.relativePath}/`)) return;
    if (file.folderId) {
      const fileFolder = await this.prisma.folder.findUnique({ where: { id: file.folderId } });
      if (fileFolder && !fileFolder.deletedAt && fileFolder.ownerId === root.ownerId && fileFolder.relativePath.startsWith(`${root.relativePath}/`)) return;
    }
    throw new NotFoundException('Shared file is not inside this folder');
  }

  private normalizeRelativePath(path: string) {
    const normalized = `/${path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/+/g, '/');
    return normalized === '/' ? normalized : normalized.replace(/\/$/, '');
  }

  private isDirectChildPath(parentPath: string, childPath: string) {
    const parent = this.normalizeRelativePath(parentPath);
    const child = this.normalizeRelativePath(childPath);
    if (!child.startsWith(`${parent}/`)) return false;
    return child.slice(parent.length + 1).split('/').filter(Boolean).length === 1;
  }

  async getPublicFolderContents(publicToken: string, requestedFolderId?: string) {
    const { link, root, folder } = await this.resolvePublicFolder(publicToken, requestedFolderId);
    const folderPrefix = `${this.normalizeRelativePath(folder.relativePath)}/`;
    const [folderCandidates, fileCandidates] = await Promise.all([
      this.prisma.folder.findMany({
        where: {
          ownerId: root.ownerId,
          deletedAt: null,
          OR: [
            { parentFolderId: folder.id },
            { relativePath: { startsWith: folderPrefix } },
          ],
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, parentFolderId: true, relativePath: true, createdAt: true },
      }),
      this.prisma.file.findMany({
        where: {
          ownerId: root.ownerId,
          deletedAt: null,
          OR: [
            { folderId: folder.id },
            { relativePath: { startsWith: folderPrefix } },
          ],
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, mimeType: true, size: true, updatedAt: true, folderId: true, relativePath: true },
      }),
    ]);
    const folders = folderCandidates.filter((child) => child.parentFolderId === folder.id || this.isDirectChildPath(folder.relativePath, child.relativePath));
    const files = fileCandidates.filter((file) => file.folderId === folder.id || this.isDirectChildPath(folder.relativePath, file.relativePath));
    return {
      type: 'folder' as const,
      permission: link.permission,
      description: link.description,
      expiresAt: link.expiresAt,
      folder: {
        id: folder.id,
        name: folder.name,
        files: files.length,
        folders: folders.map((child) => ({ ...child })),
        items: files.map((file) => ({ ...file, size: Number(file.size) })),
      },
    };
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
        description: link.description,
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
      return this.getPublicFolderContents(publicToken, link.folderId);
    }

    throw new NotFoundException('Link has no target');
  }

  async updatePublicText(publicToken: string, content: string) {
    const link = await this.resolveActiveLink(publicToken);
    if (link.permission !== SharePermission.EDIT || !link.fileId) {
      throw new ForbiddenException('This link does not allow editing');
    }
    const file = await this.prisma.file.findUnique({ where: { id: link.fileId } });
    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    const editable = file.mimeType.startsWith('text/') || /json|xml|javascript|typescript|csv|markdown/.test(file.mimeType);
    if (!editable) throw new BadRequestException('Only text-like files can be edited in the browser');

    const buffer = Buffer.from(content, 'utf8');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (file.sha256 === sha256) return { id: file.id, versionNumber: file.versionNumber, unchanged: true };
    const versionNumber = file.versionNumber + 1;
    const storagePath = `files/${file.id}/v${versionNumber}`;
    await this.storage.upload(buffer, storagePath, file.mimeType);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.create({
        data: {
          fileId: file.id,
          versionNumber,
          size: buffer.length,
          mimeType: file.mimeType,
          storagePath,
          sha256,
          syncStatus: 'PENDING',
        },
      });
      return tx.file.update({
        where: { id: file.id },
        data: { size: buffer.length, versionNumber, sha256, syncStatus: 'PENDING', lastSyncedAt: null },
      });
    });

    if (file.googleDriveFileId) {
      try {
        await this.drive.updateFileForProfile(file.ownerId, file.googleDriveFileId, { name: file.name, mimeType: file.mimeType, buffer });
      } catch {
        // The next authenticated Drive sync will retry the update.
      }
    }
    return { id: updated.id, versionNumber: updated.versionNumber, saved: true };
  }

  async previewPublic(publicToken: string, res: Response, requestedFileId?: string) {
    const link = await this.resolveActiveLink(publicToken);
    const fileId = link.fileId ?? requestedFileId;
    const file = fileId ? await this.prisma.file.findUnique({ where: { id: fileId } }) : null;
    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    await this.assertPublicFileAccess(link, file);
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: file.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (!latestVersion?.storagePath) throw new NotFoundException('File version not found');
    const buffer = await this.storage.download(latestVersion.storagePath);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  async downloadPublic(publicToken: string, res: Response, requestedFileId?: string) {
    const link = await this.resolveActiveLink(publicToken);

    if (link.permission !== SharePermission.DOWNLOAD && link.permission !== SharePermission.EDIT) {
      throw new ForbiddenException('This link does not allow downloads');
    }

    if (link.downloadLimit !== null && link.downloadLimit > 0 && link.downloadCount >= link.downloadLimit) {
      throw new ForbiddenException('Download limit reached');
    }

    const targetFileId = link.fileId ?? requestedFileId;
    const file = targetFileId
      ? await this.prisma.file.findUnique({ where: { id: targetFileId } })
      : null;

    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    await this.assertPublicFileAccess(link, file);

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
