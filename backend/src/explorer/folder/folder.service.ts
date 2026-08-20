import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { DriveService } from '../../drive/drive.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto';
import { DEFAULT_CORE_FOLDER_NAME } from '../core-folder.constants';
import { SyncStatusService } from '../../sync/sync-status.service';
import { SyncOperation } from '@prisma/client';
import type { IStorageService } from '../../storage/storage.service.interface';
import { STORAGE_SERVICE_TOKEN } from '../../storage/storage.module';
import { Inject } from '@nestjs/common';

@Injectable()
export class FolderService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private drive: DriveService,
    @Inject(STORAGE_SERVICE_TOKEN) private storage: IStorageService,
    private sync: SyncStatusService,
  ) {}

  private async emitRemoteChange(profileId: string, change: Parameters<SyncStatusService['emitRemoteChange']>[1]) {
    try {
      await this.sync.emitRemoteChange(profileId, change);
    } catch (error) {
      // Remote queue failure must not roll back a successful folder operation.
    }
  }

  private async ensureDefaultCoreFolder(profileId: string) {
    const existing = await this.prisma.folder.findFirst({
      where: { ownerId: profileId, parentFolderId: null, name: DEFAULT_CORE_FOLDER_NAME, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const folder = await this.prisma.folder.create({
      data: {
        name: DEFAULT_CORE_FOLDER_NAME,
        ownerId: profileId,
        parentFolderId: null,
        relativePath: `/${DEFAULT_CORE_FOLDER_NAME}`,
        visibility: 'PRIVATE',
      },
    });
    try {
      const driveFolderId = await this.drive.createFolderForProfile(profileId, DEFAULT_CORE_FOLDER_NAME, null);
      if (driveFolderId) {
        const mirrored = await this.prisma.folder.update({
          where: { id: folder.id },
          data: { googleDriveFolderId: driveFolderId, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
        await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, folderId: mirrored.id, relativePath: mirrored.relativePath, name: mirrored.name });
        return mirrored;
      }
    } catch (error) {
      // Local organization remains valid; Drive reconciliation can retry later.
    }
    await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, folderId: folder.id, relativePath: folder.relativePath, name: folder.name });
    return folder;
  }

  async rootFolders(profileId: string) {
    await this.organizeRootFiles(profileId);
    return this.prisma.folder.findMany({
      where: { ownerId: profileId, parentFolderId: null, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async organizeRootFiles(profileId: string) {
    const core = await this.ensureDefaultCoreFolder(profileId);
    const rootFolders = await this.prisma.folder.findMany({
      where: { ownerId: profileId, parentFolderId: null, deletedAt: null, id: { not: core.id } },
      orderBy: { createdAt: 'asc' },
    });
    let foldersMoved = 0;
    for (const folder of rootFolders) {
      await this.update(profileId, folder.id, { parentFolderId: core.id } as UpdateFolderDto);
      foldersMoved++;
    }

    const rootFiles = await this.prisma.file.findMany({
      where: { ownerId: profileId, folderId: null, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    let moved = 0;
    for (const file of rootFiles) {
      let name = file.name;
      let relativePath = `${core.relativePath}/${name}`;
      const conflict = await this.prisma.file.findFirst({
        where: { ownerId: profileId, folderId: core.id, relativePath, deletedAt: null, id: { not: file.id } },
        select: { id: true },
      });
      if (conflict) {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const extension = dot > 0 ? name.slice(dot) : '';
        name = `${stem} (moved-${file.id.slice(0, 8)})${extension}`;
        relativePath = `${core.relativePath}/${name}`;
      }

      let driveSynced = false;
      if (file.googleDriveFileId && core.googleDriveFolderId) {
        try {
          await this.drive.moveFileForProfile(profileId, file.googleDriveFileId, core.googleDriveFolderId);
          driveSynced = true;
        } catch (error) {
          // Keep the file locally organized and let the next Drive sync retry.
        }
      }
      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          name,
          folderId: core.id,
          relativePath,
          syncStatus: driveSynced ? 'SYNCED' : 'PENDING',
          ...(driveSynced ? { lastSyncedAt: new Date() } : {}),
        },
      });
      moved++;
    }
    return { folderName: core.name, folderId: core.id, foldersMoved, moved };
  }

  async getContents(
    profileId: string,
    folderId?: string,
    page = 1,
    pageSize = 50,
    filter?: string,
  ) {
    if (!folderId) await this.organizeRootFiles(profileId);
    const take = Math.min(200, pageSize);
    const skip = (page - 1) * take;

    const whereBase: {
      ownerId: string;
      deletedAt: Date | null;
      parentFolderId?: string;
    } = { ownerId: profileId, deletedAt: null };
    if (folderId) whereBase.parentFolderId = folderId;

    const folders = await this.prisma.folder.findMany({
      where: { ...whereBase },
      orderBy: { name: 'asc' },
      take,
      skip,
    });

    const fileWhere: {
      ownerId: string;
      deletedAt: Date | null;
      folderId?: string | null;
      name?: { contains: string; mode: 'insensitive' };
    } = { ownerId: profileId, deletedAt: null, folderId: folderId ?? null };
    if (filter) fileWhere.name = { contains: filter, mode: 'insensitive' };

    const files = await this.prisma.file.findMany({
      where: fileWhere,
      orderBy: [{ updatedAt: 'desc' }],
      take,
      skip,
    });

    return {
      folders,
      files: files.map((file) => ({ ...file, size: Number(file.size) })),
    };
  }

  async create(profileId: string, dto: CreateFolderDto) {
    let parentFolderId = dto.parentFolderId ?? null;
    if (!parentFolderId && dto.name.trim() !== DEFAULT_CORE_FOLDER_NAME) {
      parentFolderId = (await this.ensureDefaultCoreFolder(profileId)).id;
    }
    const parent = parentFolderId
      ? await this.prisma.folder.findUnique({
          where: { id: parentFolderId },
        })
      : null;
    if (parentFolderId && !parent)
      throw new NotFoundException('Parent folder not found');

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        ownerId: profileId,
        parentFolderId,
        relativePath: parent
          ? `${parent.relativePath}/${dto.name}`
          : `/${dto.name}`,
        visibility: dto.visibility as
          'PRIVATE' | 'RESTRICTED' | 'ORGANIZATION' | 'PUBLIC',
      },
    });

    try {
      const parentDriveId = parent?.googleDriveFolderId ?? null;
      const driveFolderId = await this.drive.createFolderForProfile(profileId, folder.name, parentDriveId);
      if (driveFolderId) {
        const mirrored = await this.prisma.folder.update({
          where: { id: folder.id },
          data: { googleDriveFolderId: driveFolderId, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
        await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, folderId: mirrored.id, relativePath: mirrored.relativePath, name: mirrored.name });
        return mirrored;
      }
    } catch {
      // Drive mirroring is best-effort; the local folder remains usable.
    }

    await this.audit.log(profileId, 'CREATE', 'FOLDER', folder.id, {
      name: folder.name,
    });
    await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, folderId: folder.id, relativePath: folder.relativePath, name: folder.name });
    return folder;
  }

  async update(profileId: string, id: string, dto: UpdateFolderDto) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId || folder.deletedAt) throw new NotFoundException('Folder not found');
    const parentFolderId = dto.parentFolderId !== undefined ? dto.parentFolderId : folder.parentFolderId;
    const parent = parentFolderId ? await this.prisma.folder.findUnique({ where: { id: parentFolderId } }) : null;
    if (parentFolderId && (!parent || parent.ownerId !== profileId || parent.id === id)) throw new NotFoundException('Destination folder not found');
    const name = dto.name?.trim() || folder.name;
    const oldPath = folder.relativePath;
    const relativePath = parent ? `${parent.relativePath}/${name}` : `/${name}`;
    const data: {
      name?: string;
      parentFolderId?: string | null;
      relativePath?: string;
      visibility?: 'PRIVATE' | 'RESTRICTED' | 'ORGANIZATION' | 'PUBLIC';
    } = { name, parentFolderId, relativePath };
    if (dto.visibility) data.visibility = dto.visibility as 'PRIVATE' | 'RESTRICTED' | 'ORGANIZATION' | 'PUBLIC';
    const updated = await this.prisma.folder.update({ where: { id }, data });
    const descendants = await this.prisma.folder.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${oldPath}/` }, deletedAt: null } });
    for (const child of descendants) {
      await this.prisma.folder.update({ where: { id: child.id }, data: { relativePath: `${relativePath}${child.relativePath.slice(oldPath.length)}` } });
    }
    const files = await this.prisma.file.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${oldPath}/` }, deletedAt: null } });
    for (const file of files) await this.prisma.file.update({ where: { id: file.id }, data: { relativePath: `${relativePath}${file.relativePath.slice(oldPath.length)}` } });
    try {
      if (folder.googleDriveFolderId) {
        await this.drive.renameFileForProfile(profileId, folder.googleDriveFolderId, name);
        if (!parentFolderId || parent?.googleDriveFolderId) {
          await this.drive.moveFileForProfile(profileId, folder.googleDriveFolderId, parent?.googleDriveFolderId ?? null);
        }
      }
    } catch (error) { /* Drive retry will reconcile this folder on next sync. */ }
    await this.audit.log(profileId, 'UPDATE', 'FOLDER', id, { changes: data });
    await this.emitRemoteChange(profileId, { operation: name !== folder.name ? SyncOperation.RENAME : SyncOperation.MOVE, folderId: id, oldRelativePath: oldPath, relativePath: updated.relativePath, name: updated.name });
    return updated;
  }

  async copy(profileId: string, id: string) {
    const source = await this.prisma.folder.findUnique({ where: { id } });
    if (!source || source.ownerId !== profileId || source.deletedAt) throw new NotFoundException('Folder not found');
    const parent = source.parentFolderId ? await this.prisma.folder.findUnique({ where: { id: source.parentFolderId } }) : null;
    const rootCopy = await this.create(profileId, { name: `${source.name} copy`, parentFolderId: source.parentFolderId ?? null } as CreateFolderDto);
    const folderMap = new Map<string, string>([[source.id, rootCopy.id]]);
    const children = await this.prisma.folder.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${source.relativePath}/` }, deletedAt: null }, orderBy: { relativePath: 'asc' } });
    for (const child of children) {
      const childParent = child.parentFolderId ? folderMap.get(child.parentFolderId) : rootCopy.id;
      const copied = await this.create(profileId, { name: child.name, parentFolderId: childParent ?? rootCopy.id } as CreateFolderDto);
      folderMap.set(child.id, copied.id);
    }
    const files = await this.prisma.file.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${source.relativePath}/` }, deletedAt: null } });
    for (const file of files) {
      const targetFolderId = file.folderId ? folderMap.get(file.folderId) : rootCopy.id;
      const latest = await this.prisma.fileVersion.findFirst({ where: { fileId: file.id }, orderBy: { versionNumber: 'desc' } });
      const copied = await this.prisma.file.create({ data: { name: file.name, extension: file.extension, ownerId: profileId, folderId: targetFolderId ?? null, relativePath: targetFolderId ? `${(await this.prisma.folder.findUnique({ where: { id: targetFolderId } }))?.relativePath}/${file.name}` : `/${file.name}`, mimeType: file.mimeType, size: file.size, sha256: file.sha256, versionNumber: 1, visibility: file.visibility } });
      if (latest?.storagePath) {
        const buffer = await this.storage.download(latest.storagePath);
        const storagePath = `files/${copied.id}/v1`;
        await this.storage.upload(buffer, storagePath, file.mimeType);
        await this.prisma.fileVersion.create({ data: { fileId: copied.id, versionNumber: 1, size: file.size, mimeType: file.mimeType, storagePath, sha256: file.sha256 } });
      }
      await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, fileId: copied.id, folderId: copied.folderId, relativePath: copied.relativePath, name: copied.name, mimeType: copied.mimeType, size: copied.size, sha256: copied.sha256 });
    }
    await this.audit.log(profileId, 'CREATE', 'FOLDER', rootCopy.id, { action: 'copy', sourceFolderId: id });
    return rootCopy;
  }

  async softDelete(profileId: string, id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId)
      throw new NotFoundException('Folder not found');
    if (folder.deletedAt) return folder;

    const deletedAt = new Date();
    const descendants = await this.prisma.folder.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${folder.relativePath}/` }, deletedAt: null } });
    const files = await this.prisma.file.findMany({ where: { ownerId: profileId, relativePath: { startsWith: `${folder.relativePath}/` }, deletedAt: null } });
    await this.prisma.folder.update({ where: { id }, data: { deletedAt } });
    await this.prisma.folder.updateMany({ where: { id: { in: descendants.map((child) => child.id) } }, data: { deletedAt } });
    await this.prisma.file.updateMany({ where: { id: { in: files.map((file) => file.id) } }, data: { deletedAt } });
    const deleted = await this.prisma.folder.findUnique({ where: { id } });
    if (folder.googleDriveFolderId) {
      try { await this.drive.trashFileForProfile(profileId, folder.googleDriveFolderId); } catch (error) { /* retry through Drive reconciliation */ }
    }
    const activeTrash = await this.prisma.trash.findFirst({ where: { profileId, folderId: id, restoredAt: null } });
    if (!activeTrash) await this.prisma.trash.create({ data: { profileId, folderId: id, deletedAt: new Date() } });
    await this.audit.log(profileId, 'DELETE', 'FOLDER', id, {
      name: folder.name,
    });
    await this.emitRemoteChange(profileId, { operation: SyncOperation.DELETE, folderId: id, relativePath: folder.relativePath, name: folder.name });
    return deleted;
  }

  async restore(profileId: string, id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId)
      throw new NotFoundException('Folder not found');
    if (!folder.deletedAt) throw new BadRequestException('Folder not deleted');

    const restored = await this.prisma.folder.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.prisma.trash.updateMany({
      where: { folderId: id, profileId },
      data: { restoredAt: new Date() },
    });
    await this.audit.log(profileId, 'RESTORE', 'FOLDER', id, {
      name: folder.name,
    });
    await this.emitRemoteChange(profileId, { operation: SyncOperation.UPLOAD, folderId: restored.id, relativePath: restored.relativePath, name: restored.name });
    return restored;
  }
}
