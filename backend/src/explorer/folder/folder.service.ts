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
  ) {}

  async rootFolders(profileId: string) {
    return this.prisma.folder.findMany({
      where: { ownerId: profileId, parentFolderId: null, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getContents(
    profileId: string,
    folderId?: string,
    page = 1,
    pageSize = 50,
    filter?: string,
  ) {
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

    return { folders, files };
  }

  async create(profileId: string, dto: CreateFolderDto) {
    const parent = dto.parentFolderId
      ? await this.prisma.folder.findUnique({
          where: { id: dto.parentFolderId },
        })
      : null;
    if (dto.parentFolderId && !parent)
      throw new NotFoundException('Parent folder not found');

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        ownerId: profileId,
        parentFolderId: dto.parentFolderId ?? null,
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
        return this.prisma.folder.update({
          where: { id: folder.id },
          data: { googleDriveFolderId: driveFolderId, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
      }
    } catch {
      // Drive mirroring is best-effort; the local folder remains usable.
    }

    await this.audit.log(profileId, 'CREATE', 'FOLDER', folder.id, {
      name: folder.name,
    });
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
        await this.drive.moveFileForProfile(profileId, folder.googleDriveFolderId, parent?.googleDriveFolderId ?? null);
      }
    } catch (error) { /* Drive retry will reconcile this folder on next sync. */ }
    await this.audit.log(profileId, 'UPDATE', 'FOLDER', id, { changes: data });
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
    }
    await this.audit.log(profileId, 'CREATE', 'FOLDER', rootCopy.id, { action: 'copy', sourceFolderId: id });
    return rootCopy;
  }

  async softDelete(profileId: string, id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId)
      throw new NotFoundException('Folder not found');
    if (folder.deletedAt)
      throw new BadRequestException('Folder already deleted');

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
    await this.prisma.trash.create({
      data: { profileId, folderId: id, deletedAt: new Date() },
    });
    await this.audit.log(profileId, 'DELETE', 'FOLDER', id, {
      name: folder.name,
    });
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
    return restored;
  }
}
