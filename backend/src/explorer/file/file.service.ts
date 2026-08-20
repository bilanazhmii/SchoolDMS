import crypto from 'crypto';
import { Readable } from 'stream';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../../audit/audit.service';
import { DriveService } from '../../drive/drive.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { IStorageService } from '../../storage/storage.service.interface';
import { STORAGE_SERVICE_TOKEN } from '../../storage/storage.module';
import {
  FileValidator,
  FileValidationConfig,
} from '../../storage/dto/file-validation.dto';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly fileValidator: FileValidator;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private drive: DriveService,
    @Inject(STORAGE_SERVICE_TOKEN) private storage: IStorageService,
    private config: ConfigService,
  ) {
    // Initialize file validator with configuration
    const validationConfig = new FileValidationConfig();
    const maxSize = this.config.get<string>('MAX_FILE_SIZE');
    if (maxSize) {
      validationConfig.maxSize = parseInt(maxSize, 10) * 1024 * 1024; // Convert MB to bytes
    }
    this.fileValidator = new FileValidator(validationConfig);
  }

  async get(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    if (file.ownerId !== profileId)
      throw new NotFoundException('File not found');

    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });
    return { ...file, versions };
  }

  async upload(
    profileId: string,
    fileMeta: { name: string; mimeType: string; size: number; buffer?: Buffer },
    folderId?: string,
    relativePathHint?: string,
  ) {
    // Validate file before processing
    if (!fileMeta.buffer) {
      throw new BadRequestException('File buffer is required for upload');
    }

    const sanitizedFilename = this.fileValidator.sanitizeFilename(
      fileMeta.name,
    );
    const validationResult = this.fileValidator.validate(
      sanitizedFilename,
      fileMeta.mimeType,
      fileMeta.size,
    );

    if (!validationResult.valid) {
      throw new BadRequestException(
        `File validation failed: ${validationResult.errors.join(', ')}`,
      );
    }

    // Prefer an explicit folderId; otherwise rebuild the folder tree from the
    // relative path sent by the desktop client (e.g. "Docs/Reports/a.pdf").
    if (!folderId && relativePathHint) {
      folderId = await this.ensureFolderPath(profileId, relativePathHint);
    }

    let relativePath = `/${sanitizedFilename}`;
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (folder) {
        relativePath = `${folder.relativePath}/${sanitizedFilename}`;
      }
    }

    const contentHash = crypto.createHash('sha256').update(fileMeta.buffer as Buffer).digest('hex');
    const existing = await this.prisma.file.findFirst({
      where: { ownerId: profileId, relativePath, deletedAt: null },
    });
    if (existing) {
      const latestExistingVersion = await this.prisma.fileVersion.findFirst({
        where: { fileId: existing.id },
        orderBy: { versionNumber: 'desc' },
      });
      if (existing.sha256 === contentHash || latestExistingVersion?.sha256 === contentHash) {
        return existing;
      }
      const versionNumber = existing.versionNumber + 1;
      const storagePath = `files/${existing.id}/v${versionNumber}`;
      await this.storage.upload(fileMeta.buffer, storagePath, fileMeta.mimeType);
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.fileVersion.create({
          data: {
            fileId: existing.id,
            versionNumber,
            size: fileMeta.size,
            mimeType: fileMeta.mimeType,
            storagePath,
            sha256: contentHash,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        return tx.file.update({
          where: { id: existing.id },
          data: {
            name: sanitizedFilename,
            size: fileMeta.size,
            mimeType: fileMeta.mimeType,
            versionNumber,
            sha256: contentHash,
            syncStatus: 'PENDING',
          },
        });
      });
      try {
        if (existing.googleDriveFileId) {
          await this.drive.updateFileForProfile(profileId, existing.googleDriveFileId, {
            name: sanitizedFilename,
            mimeType: fileMeta.mimeType,
            buffer: fileMeta.buffer as Buffer,
          });
        }
      } catch (error) {
        this.logger.warn(`Google Drive update failed for ${existing.id}`, error as Error);
      }
      return updated;
    }

    // Create file record and initial version with storage
    const created = await this.prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          name: sanitizedFilename,
          ownerId: profileId,
          folderId: folderId ?? null,
          size: fileMeta.size,
          mimeType: fileMeta.mimeType,
          relativePath,
          sha256: contentHash,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
      });

      const storagePath = `files/${file.id}/v1`;

      // Store file in storage (buffer is guaranteed to be defined after validation)
      await this.storage.upload(
        fileMeta.buffer as Buffer,
        storagePath,
        fileMeta.mimeType,
      );

      await tx.fileVersion.create({
        data: {
          fileId: file.id,
          versionNumber: 1,
          size: fileMeta.size,
          mimeType: fileMeta.mimeType,
          storagePath,
          sha256: contentHash,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
      });

      await this.audit.log(profileId, 'CREATE', 'FILE', file.id, {
        name: file.name,
      });
      this.logger.log(
        `File uploaded successfully: ${file.name} (${fileMeta.size} bytes)`,
      );
      return file;
    });

    // Keep the backend storage authoritative, then mirror to Drive when the
    // user has connected Google Drive. A Drive outage must not lose the upload.
    try {
      const folder = created.folderId
        ? await this.prisma.folder.findUnique({ where: { id: created.folderId } })
        : null;
      const driveFile = await this.drive.uploadFileForProfile(
        profileId,
        {
          name: created.name,
          mimeType: fileMeta.mimeType,
          buffer: fileMeta.buffer as Buffer,
        },
        folder?.googleDriveFolderId,
      );
      if (driveFile?.id) {
        return this.prisma.file.update({
          where: { id: created.id },
          data: { googleDriveFileId: driveFile.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`Google Drive mirror failed for ${created.id}`, error as Error);
    }
    return created;
  }

  /**
   * Walks a relative file path ("Docs/Reports/a.pdf") and creates any missing
   * folders under the user's root. Returns the parent folder id for the file.
   */
  private async ensureFolderPath(
    profileId: string,
    relativePathHint: string,
  ): Promise<string | undefined> {
    const normalized = relativePathHint.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 1) return undefined;

    const folderNames = parts.slice(0, -1);
    let parentId: string | undefined;
    let walked = '';

    for (const name of folderNames) {
      walked = walked ? `${walked}/${name}` : `/${name}`;
      const existing = await this.prisma.folder.findFirst({
        where: {
          ownerId: profileId,
          parentFolderId: parentId ?? null,
          name,
          deletedAt: null,
        },
      });
      if (existing) {
        parentId = existing.id;
        continue;
      }
      const created = await this.prisma.folder.create({
        data: {
          name,
          ownerId: profileId,
          parentFolderId: parentId ?? null,
          relativePath: walked.startsWith('/') ? walked : `/${walked}`,
        },
      });
      parentId = created.id;
    }

    return parentId;
  }

  async softDelete(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');
    if (file.deletedAt) throw new BadRequestException('File already deleted');

    const deleted = await this.prisma.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.trash.create({
      data: { profileId, fileId: id, deletedAt: new Date() },
    });
    await this.audit.log(profileId, 'DELETE', 'FILE', id, { name: file.name });
    try {
      if (file.googleDriveFileId) {
        await this.drive.trashFileForProfile(profileId, file.googleDriveFileId);
      }
    } catch (error) {
      this.logger.warn(`Google Drive trash failed for ${id}`, error as Error);
    }
    return deleted;
  }

  async softDeleteByRelativePath(profileId: string, relativePath: string) {
    const normalized = `/${relativePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const file = await this.prisma.file.findFirst({
      where: { ownerId: profileId, relativePath: normalized, deletedAt: null },
    });
    if (!file) return { missing: true, relativePath: normalized };
    return this.softDelete(profileId, file.id);
  }

  async restore(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');
    if (!file.deletedAt) throw new BadRequestException('File not deleted');

    const restored = await this.prisma.file.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.prisma.trash.updateMany({
      where: { fileId: id, profileId },
      data: { restoredAt: new Date() },
    });
    await this.audit.log(profileId, 'RESTORE', 'FILE', id, { name: file.name });
    return restored;
  }

  async listVersions(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');
    return this.prisma.fileVersion.findMany({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async moveByRelativePath(profileId: string, oldRelativePath: string, newRelativePath: string) {
    const oldPath = `/${oldRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const newPath = `/${newRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const file = await this.prisma.file.findFirst({
      where: { ownerId: profileId, relativePath: oldPath, deletedAt: null },
    });
    if (!file) return { missing: true, relativePath: oldPath };

    const parts = newPath.split('/').filter(Boolean);
    const name = parts.pop() ?? file.name;
    const folderId = parts.length > 0
      ? await this.ensureFolderPath(profileId, `${parts.join('/')}/${name}`)
      : undefined;
    const folder = folderId
      ? await this.prisma.folder.findUnique({ where: { id: folderId } })
      : null;
    const relativePath = folder ? `${folder.relativePath}/${name}` : `/${name}`;
    const moved = await this.prisma.file.update({
      where: { id: file.id },
      data: { name, folderId: folderId ?? null, relativePath },
    });
    try {
      if (file.googleDriveFileId) {
        await this.drive.moveFileForProfile(profileId, file.googleDriveFileId, folder?.googleDriveFolderId ?? null);
        if (name !== file.name) {
          const latest = await this.prisma.fileVersion.findFirst({ where: { fileId: file.id }, orderBy: { versionNumber: 'desc' } });
          if (latest?.storagePath) {
            const buffer = await this.storage.download(latest.storagePath);
            await this.drive.updateFileForProfile(profileId, file.googleDriveFileId, { name, mimeType: file.mimeType, buffer });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Google Drive rename/move failed for ${file.id}`, error as Error);
    }
    return moved;
  }

  async move(
    profileId: string,
    id: string,
    toFolderId?: string | null,
  ) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId || file.deletedAt)
      throw new NotFoundException('File not found');

    let relativePath = file.relativePath;
    if (toFolderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: toFolderId },
      });
      if (!folder || folder.ownerId !== profileId)
        throw new NotFoundException('Destination folder not found');
      relativePath = `${folder.relativePath}/${file.name}`;
    } else {
      relativePath = `/${file.name}`;
    }

    const moved = await this.prisma.file.update({
      where: { id },
      data: { folderId: toFolderId ?? null, relativePath },
    });
    await this.audit.log(profileId, 'UPDATE', 'FILE', id, {
      action: 'move',
      toFolderId: toFolderId ?? null,
    });
    try {
      if (file.googleDriveFileId) {
        const destination = toFolderId
          ? await this.prisma.folder.findUnique({ where: { id: toFolderId } })
          : null;
        await this.drive.moveFileForProfile(
          profileId,
          file.googleDriveFileId,
          destination?.googleDriveFolderId ?? null,
        );
      }
    } catch (error) {
      this.logger.warn(`Google Drive move failed for ${id}`, error as Error);
    }
    return moved;
  }

  async copy(
    profileId: string,
    id: string,
    toFolderId?: string | null,
  ) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId || file.deletedAt)
      throw new NotFoundException('File not found');

    let relativePath = `/${file.name}`;
    if (toFolderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: toFolderId },
      });
      if (!folder || folder.ownerId !== profileId)
        throw new NotFoundException('Destination folder not found');
      relativePath = `${folder.relativePath}/${file.name}`;
    }

    // Copy latest version's content into a brand-new file + version.
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      const newFile = await tx.file.create({
        data: {
          name: file.name,
          extension: file.extension,
          ownerId: profileId,
          folderId: toFolderId ?? null,
          relativePath,
          mimeType: file.mimeType,
          size: file.size,
          versionNumber: 1,
          visibility: file.visibility,
        },
      });

      if (latestVersion?.storagePath) {
        const sourcePath = latestVersion.storagePath;
        const targetPath = `files/${newFile.id}/v1`;
        try {
          const buffer = await this.storage.download(sourcePath);
          await this.storage.upload(buffer, targetPath, file.mimeType);
          await tx.fileVersion.create({
            data: {
              fileId: newFile.id,
              versionNumber: 1,
              size: file.size,
              mimeType: file.mimeType,
              storagePath: targetPath,
            },
          });
        } catch (error) {
          this.logger.error(`Copy storage failed for file ${id}`, error);
        }
      }

      await this.audit.log(profileId, 'CREATE', 'FILE', newFile.id, {
        action: 'copy',
        sourceFileId: id,
      });
      return newFile;
    });
  }

  async preview(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');

    // Get the latest version
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion || !latestVersion.storagePath) {
      throw new NotFoundException('File version not found');
    }

    if (file.googleDriveFileId) {
      return {
        drive: true,
        previewUrl: `/files/${id}/stream`,
        streamUrl: `/files/${id}/stream`,
        fileName: file.name,
        mimeType: file.mimeType,
        canPreview: this.canGeneratePreview(file.mimeType),
      };
    }

    // For local storage, check if file exists and return preview info
    const exists = await this.storage.exists(latestVersion.storagePath);
    if (!exists) {
      throw new NotFoundException('File not found in storage');
    }

    // Determine if preview is possible based on MIME type
    const canPreview = this.canGeneratePreview(file.mimeType);

    return {
      drive: false,
      previewUrl: `/files/${id}/preview`,
      streamUrl: `/files/${id}/stream`,
      fileName: file.name,
      mimeType: file.mimeType,
      canPreview,
    };
  }

  private canGeneratePreview(mimeType: string | null): boolean {
    if (!mimeType) return false;

    const previewableTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/html',
      'application/json',
    ];

    return previewableTypes.includes(mimeType);
  }

  async download(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    if (file.ownerId !== profileId)
      throw new NotFoundException('File not found');

    // Get the latest version
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion || !latestVersion.storagePath) {
      throw new NotFoundException('File version not found');
    }

    // Proxy Google Drive content through the authenticated backend.
    if (file.googleDriveFileId) {
      const buffer = await this.drive.downloadFileForProfile(profileId, file.googleDriveFileId);
      if (!buffer) throw new NotFoundException('Drive file is not available');
      return {
        drive: true,
        buffer,
        fileName: file.name,
        mimeType: file.mimeType,
      };
    }

    // Download from local storage
    const buffer = await this.storage.download(latestVersion.storagePath);
    this.logger.log(`File downloaded: ${file.name} (${buffer.length} bytes)`);

    return {
      drive: false,
      buffer,
      fileName: file.name,
      mimeType: file.mimeType,
    };
  }

  async deleteFileFromStorage(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');

    // Get all versions to delete from storage
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId: id },
    });

    // Delete each version from storage
    for (const version of versions) {
      if (version.storagePath) {
        try {
          await this.storage.delete(version.storagePath);
          this.logger.debug(`Deleted storage file: ${version.storagePath}`);
        } catch (error) {
          this.logger.error(
            `Failed to delete storage file: ${version.storagePath}`,
            error,
          );
          // Continue with other deletions even if one fails
        }
      }
    }

    this.logger.log(`All storage files deleted for: ${file.name}`);
  }

  async getStream(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.deletedAt) throw new NotFoundException('File not found');
    if (file.ownerId !== profileId)
      throw new NotFoundException('File not found');

    // Get the latest version
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });

    if (!latestVersion || !latestVersion.storagePath) {
      throw new NotFoundException('File version not found');
    }

    // Proxy Google Drive content through the authenticated backend.
    if (file.googleDriveFileId) {
      const buffer = await this.drive.downloadFileForProfile(profileId, file.googleDriveFileId);
      if (!buffer) throw new NotFoundException('Drive file is not available');
      return {
        drive: true,
        stream: Readable.from(buffer),
        fileName: file.name,
        mimeType: file.mimeType,
      };
    }

    // Get stream from local storage
    const stream = await this.storage.getStream(latestVersion.storagePath);
    this.logger.log(`Stream created for: ${file.name}`);

    return {
      drive: false,
      stream,
      fileName: file.name,
      mimeType: file.mimeType,
    };
  }
}
