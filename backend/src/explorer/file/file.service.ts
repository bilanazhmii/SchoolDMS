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
import { DEFAULT_CORE_FOLDER_NAME } from '../core-folder.constants';
import { SyncStatusService } from '../../sync/sync-status.service';
import { SyncOperation } from '@prisma/client';

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
    private sync: SyncStatusService,
  ) {
    // Initialize file validator with configuration
    const validationConfig = new FileValidationConfig();
    const maxSize = this.config.get<string>('MAX_FILE_SIZE');
    if (maxSize) {
      validationConfig.maxSize = parseInt(maxSize, 10) * 1024 * 1024; // Convert MB to bytes
    }
    this.fileValidator = new FileValidator(validationConfig);
  }

  private serializeVersion<T extends { size: bigint | number | null }>(version: T) {
    return {
      ...version,
      size: version.size == null ? null : Number(version.size),
    };
  }

  private serializeFile<T extends { size: bigint | number }>(file: T) {
    return { ...file, size: Number(file.size) };
  }

  private async emitRemoteChange(profileId: string, change: Parameters<SyncStatusService['emitRemoteChange']>[1]) {
    try {
      await this.sync.emitRemoteChange(profileId, change);
    } catch (error) {
      this.logger.warn('Remote change emission failed', error as Error);
    }
  }

  private synchronizedPathVariants(rawPath: string) {
    const normalized = `/${rawPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const variants = [normalized];
    if (!normalized.toLowerCase().startsWith(`/${DEFAULT_CORE_FOLDER_NAME.toLowerCase()}/`)) {
      variants.push(`/${DEFAULT_CORE_FOLDER_NAME}${normalized}`);
    }
    return [...new Set(variants)];
  }

  private async ensureDefaultCoreFolder(profileId: string) {
    const canonicalKey = `core:${profileId}`;
    const existing = await this.prisma.folder.findFirst({
      where: { OR: [{ canonicalKey }, { ownerId: profileId, parentFolderId: null, name: DEFAULT_CORE_FOLDER_NAME, deletedAt: null }] },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      if (existing.canonicalKey !== canonicalKey) {
        try { await this.prisma.folder.update({ where: { id: existing.id }, data: { canonicalKey } }); } catch { /* another request claimed the key */ }
      }
      return existing.id;
    }

    let folder;
    try {
      folder = await this.prisma.folder.create({
        data: {
          name: DEFAULT_CORE_FOLDER_NAME,
          canonicalKey,
          ownerId: profileId,
          parentFolderId: null,
          relativePath: `/${DEFAULT_CORE_FOLDER_NAME}`,
          visibility: 'PRIVATE',
        },
      });
    } catch {
      const raced = await this.prisma.folder.findUnique({ where: { canonicalKey } });
      if (raced) return raced.id;
      throw new Error('Unable to create canonical My Files folder');
    }
    try {
      const driveFolderId = await this.drive.createFolderForProfile(profileId, DEFAULT_CORE_FOLDER_NAME, null);
      if (driveFolderId) {
        await this.prisma.folder.update({
          where: { id: folder.id },
          data: { googleDriveFolderId: driveFolderId, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`Default core folder Drive mirror failed for ${profileId}`, error as Error);
    }
    return folder.id;
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
    return {
      ...this.serializeFile(file),
      versions: versions.map((version) => this.serializeVersion(version)),
    };
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
    if (!folderId) {
      folderId = await this.ensureDefaultCoreFolder(profileId);
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
        return this.serializeFile(existing);
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
      let driveSynced = false;
      try {
        if (existing.googleDriveFileId) {
          await this.drive.updateFileForProfile(existing.ownerId, existing.googleDriveFileId, {
            name: sanitizedFilename,
            mimeType: fileMeta.mimeType,
            buffer: fileMeta.buffer as Buffer,
          });
          driveSynced = true;
        }
      } catch (error) {
        this.logger.warn(`Google Drive update failed for ${existing.id}`, error as Error);
      }
      const finalFile = driveSynced
        ? await this.prisma.file.update({ where: { id: updated.id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } })
        : updated;
      await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: finalFile.id, folderId: finalFile.folderId, relativePath: finalFile.relativePath, name: finalFile.name, mimeType: finalFile.mimeType, size: finalFile.size, sha256: finalFile.sha256 });
      return this.serializeFile(finalFile);
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
        created.relativePath,
      );
      if (driveFile?.id) {
        const mirrored = await this.prisma.file.update({
          where: { id: created.id },
          data: { googleDriveFileId: driveFile.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
        await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: mirrored.id, folderId: mirrored.folderId, relativePath: mirrored.relativePath, name: mirrored.name, mimeType: mirrored.mimeType, size: mirrored.size, sha256: mirrored.sha256 });
        return this.serializeFile(mirrored);
      }
    } catch (error) {
      this.logger.warn(`Google Drive mirror failed for ${created.id}`, error as Error);
    }
    await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: created.id, folderId: created.folderId, relativePath: created.relativePath, name: created.name, mimeType: created.mimeType, size: created.size, sha256: created.sha256 });
    return this.serializeFile(created);
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

    let folderNames = parts.slice(0, -1);
    const core = await this.prisma.folder.findFirst({
      where: { ownerId: profileId, parentFolderId: null, name: DEFAULT_CORE_FOLDER_NAME, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const coreId = core?.id ?? await this.ensureDefaultCoreFolder(profileId);
    if (folderNames[0] === DEFAULT_CORE_FOLDER_NAME) folderNames = folderNames.slice(1);
    let parentId: string | undefined = coreId;
    let walked = core?.relativePath ?? `/${DEFAULT_CORE_FOLDER_NAME}`;

    for (const name of folderNames) {
      walked = `${walked}/${name}`;
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
    if (file.deletedAt) return { id: file.id, name: file.name, deletedAt: file.deletedAt };

    const deleted = await this.prisma.file.update({
      where: { id },
      data: { deletedAt: new Date(), syncStatus: 'PENDING', lastSyncedAt: null },
    });
    const activeTrash = await this.prisma.trash.findFirst({ where: { profileId, fileId: id, restoredAt: null } });
    if (!activeTrash) await this.prisma.trash.create({ data: { profileId, fileId: id, deletedAt: new Date() } });
    await this.audit.log(profileId, 'DELETE', 'FILE', id, { name: file.name });
    try {
      if (file.googleDriveFileId) {
        await this.drive.trashFileForProfile(profileId, file.googleDriveFileId);
      }
    } catch (error) {
      this.logger.warn(`Google Drive trash failed for ${id}`, error as Error);
    }
    await this.emitRemoteChange(profileId, { operation: SyncOperation.DELETE, fileId: file.id, relativePath: file.relativePath, name: file.name });
    // Delete callers only need an acknowledgement. Returning a small DTO avoids
    // sending a Prisma row through Express serialization on a destructive path.
    return { id: deleted.id, name: deleted.name, deletedAt: deleted.deletedAt };
  }

  async softDeleteMany(profileId: string, ids: string[]) {
    const requestedIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))];
    if (!requestedIds.length) return { requested: 0, deleted: 0, missing: [] as string[] };

    const files = await this.prisma.file.findMany({
      where: { id: { in: requestedIds }, ownerId: profileId, deletedAt: null },
    });
    const foundIds = new Set(files.map((file) => file.id));
    const missing = requestedIds.filter((id) => !foundIds.has(id));
    if (!files.length) return { requested: requestedIds.length, deleted: 0, missing };

    const deletedAt = new Date();
    // Keep the critical file update as one simple batch operation. Do not put
    // Trash or external Drive calls inside the transaction: a stale Trash row,
    // a schema mismatch, or a Drive outage must not roll back file deletion.
    await this.prisma.file.updateMany({
      where: { id: { in: files.map((file) => file.id) }, ownerId: profileId, deletedAt: null },
      data: { deletedAt, syncStatus: 'PENDING', lastSyncedAt: null },
    });

    // Trash is best-effort and sequential to avoid another burst of database
    // connections when Select All contains many files.
    for (const file of files) {
      try {
        const activeTrash = await this.prisma.trash.findFirst({
          where: { profileId, fileId: file.id, restoredAt: null },
          select: { id: true },
        });
        if (!activeTrash) {
          await this.prisma.trash.create({ data: { profileId, fileId: file.id, deletedAt } });
        }
      } catch (error) {
        this.logger.warn(`Bulk Trash record failed for ${file.id}`, error as Error);
      }
    }

    for (const file of files) {
      await this.emitRemoteChange(profileId, { operation: SyncOperation.DELETE, fileId: file.id, relativePath: file.relativePath, name: file.name });
      try {
        await this.audit.log(profileId, 'DELETE', 'FILE', file.id, { name: file.name });
      } catch (error) {
        this.logger.warn(`Bulk delete audit failed for ${file.id}`, error as Error);
      }
      if (file.googleDriveFileId) {
        try {
          await this.drive.trashFileForProfile(profileId, file.googleDriveFileId);
        } catch (error) {
          this.logger.warn(`Google Drive bulk trash failed for ${file.id}`, error as Error);
        }
      }
    }

    return { requested: requestedIds.length, deleted: files.length, missing };
  }

  async softDeleteByRelativePath(profileId: string, relativePath: string) {
    const variants = this.synchronizedPathVariants(relativePath);
    const file = await this.prisma.file.findFirst({
      where: { ownerId: profileId, relativePath: { in: variants }, deletedAt: null },
    });
    if (!file) return { missing: true, relativePath: variants[0] };
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
    await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: restored.id, folderId: restored.folderId, relativePath: restored.relativePath, name: restored.name, mimeType: restored.mimeType, size: restored.size, sha256: restored.sha256 });
    return this.serializeFile(restored);
  }

  async listVersions(profileId: string, id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId)
      throw new NotFoundException('File not found');
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map((version) => this.serializeVersion(version));
  }

  async moveByRelativePath(profileId: string, oldRelativePath: string, newRelativePath: string) {
    const oldVariants = this.synchronizedPathVariants(oldRelativePath);
    const newPath = `/${newRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const file = await this.prisma.file.findFirst({
      where: { ownerId: profileId, relativePath: { in: oldVariants }, deletedAt: null },
    });
    if (!file) return { missing: true, relativePath: oldVariants[0] };

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
      data: { name, folderId: folderId ?? null, relativePath, syncStatus: 'PENDING', lastSyncedAt: null },
    });
    let driveSynced = false;
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
        driveSynced = true;
      }
    } catch (error) {
      this.logger.warn(`Google Drive rename/move failed for ${file.id}`, error as Error);
    }
    const finalMoved = driveSynced
      ? await this.prisma.file.update({ where: { id: moved.id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } })
      : moved;
    await this.emitRemoteChange(profileId, { operation: name !== file.name ? SyncOperation.RENAME : SyncOperation.MOVE, fileId: file.id, folderId: finalMoved.folderId, oldRelativePath: file.relativePath, relativePath: finalMoved.relativePath, name: finalMoved.name, mimeType: finalMoved.mimeType, size: finalMoved.size, sha256: finalMoved.sha256 });
    return this.serializeFile(finalMoved);
  }

  async rename(profileId: string, id: string, name: string) {
    const cleanName = name.trim();
    if (!cleanName) throw new BadRequestException('File name is required');
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || file.ownerId !== profileId || file.deletedAt) throw new NotFoundException('File not found');
    const relativePath = file.folderId ? `${(await this.prisma.folder.findUnique({ where: { id: file.folderId } }))?.relativePath ?? ''}/${cleanName}` : `/${cleanName}`;
    const renamed = await this.prisma.file.update({ where: { id }, data: { name: cleanName, relativePath, syncStatus: 'PENDING', lastSyncedAt: null } });
    let driveSynced = false;
    if (file.googleDriveFileId) {
      try { await this.drive.renameFileForProfile(profileId, file.googleDriveFileId, cleanName); driveSynced = true; } catch (error) { this.logger.warn(`Google Drive rename failed for ${id}`, error as Error); }
    }
    const finalRenamed = driveSynced
      ? await this.prisma.file.update({ where: { id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } })
      : renamed;
    await this.audit.log(profileId, 'UPDATE', 'FILE', id, { action: 'rename', name: cleanName });
    await this.emitRemoteChange(profileId, { operation: SyncOperation.RENAME, fileId: id, folderId: finalRenamed.folderId, oldRelativePath: file.relativePath, relativePath: finalRenamed.relativePath, name: finalRenamed.name, mimeType: finalRenamed.mimeType, size: finalRenamed.size, sha256: finalRenamed.sha256 });
    return this.serializeFile(finalRenamed);
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
      data: { folderId: toFolderId ?? null, relativePath, syncStatus: 'PENDING', lastSyncedAt: null },
    });
    await this.audit.log(profileId, 'UPDATE', 'FILE', id, {
      action: 'move',
      toFolderId: toFolderId ?? null,
    });
    let driveSynced = false;
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
        driveSynced = true;
      }
    } catch (error) {
      this.logger.warn(`Google Drive move failed for ${id}`, error as Error);
    }
    const finalMoved = driveSynced
      ? await this.prisma.file.update({ where: { id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } })
      : moved;
    await this.emitRemoteChange(profileId, { operation: SyncOperation.MOVE, fileId: id, folderId: finalMoved.folderId, oldRelativePath: file.relativePath, relativePath: finalMoved.relativePath, name: finalMoved.name, mimeType: finalMoved.mimeType, size: finalMoved.size, sha256: finalMoved.sha256 });
    return this.serializeFile(finalMoved);
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

    const copied = await this.prisma.$transaction(async (tx) => {
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

    if (latestVersion?.storagePath) {
      try {
        const buffer = await this.storage.download(latestVersion.storagePath);
        const destination = toFolderId ? await this.prisma.folder.findUnique({ where: { id: toFolderId } }) : null;
        const driveFile = await this.drive.uploadFileForProfile(profileId, { name: file.name, mimeType: file.mimeType, buffer }, destination?.googleDriveFolderId ?? null, copied.relativePath);
        if (driveFile?.id) await this.prisma.file.update({ where: { id: copied.id }, data: { googleDriveFileId: driveFile.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
      } catch (error) {
        this.logger.warn(`Google Drive copy mirror failed for ${copied.id}`, error as Error);
      }
    }
    const result = await this.prisma.file.findUnique({ where: { id: copied.id } });
    if (result) await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: result.id, folderId: result.folderId, relativePath: result.relativePath, name: result.name, mimeType: result.mimeType, size: result.size, sha256: result.sha256 });
    return result ? this.serializeFile(result) : result;
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
