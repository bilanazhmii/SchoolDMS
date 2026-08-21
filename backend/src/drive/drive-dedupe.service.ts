import { Injectable, Logger } from '@nestjs/common';
import { SyncOperation } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SyncStatusService } from '../sync/sync-status.service';

export interface DedupeEntry {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  md5Checksum?: string | null;
  parentId: string;
  relativePath: string;
  isFolder: boolean;
}

@Injectable()
export class DriveDedupeService {
  private readonly logger = new Logger(DriveDedupeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncStatusService,
  ) {}

  async repair(profileId: string, entries: DedupeEntry[], trashDrive: (id: string) => Promise<unknown>) {
    const removedDriveIds = new Set<string>();
    let backendFilesRemoved = 0;
    let backendFoldersRemoved = 0;
    let driveItemsTrashed = 0;

    const backendFiles = await this.prisma.file.findMany({
      where: { ownerId: profileId, deletedAt: null },
      select: { id: true, name: true, folderId: true, relativePath: true, size: true, sha256: true, googleDriveFileId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    const backendByDriveId = new Map(backendFiles.filter((file) => file.googleDriveFileId).map((file) => [file.googleDriveFileId!, file.id]));

    const driveFileGroups = new Map<string, DedupeEntry[]>();
    for (const entry of entries.filter((item) => !item.isFolder)) {
      const key = `${entry.parentId}\0${entry.name}\0${entry.mimeType}\0${entry.size ?? ''}\0${entry.md5Checksum ?? ''}`;
      const group = driveFileGroups.get(key) ?? [];
      group.push(entry);
      driveFileGroups.set(key, group);
    }
    for (const group of driveFileGroups.values()) {
      if (group.length < 2 || !group[0].md5Checksum) continue;
      group.sort((a, b) => (backendByDriveId.has(b.id) ? 1 : 0) - (backendByDriveId.has(a.id) ? 1 : 0));
      const winner = group[0];
      for (const duplicate of group.slice(1)) {
        try {
          await trashDrive(duplicate.id);
          removedDriveIds.add(duplicate.id);
          driveItemsTrashed++;
        } catch (error) {
          this.logger.warn(`Could not trash duplicate Drive file ${duplicate.id}: ${(error as Error).message}`);
        }
      }
      const backendGroups = new Map<string, typeof backendFiles>();
      for (const file of backendFiles) {
        const key = `${file.relativePath}\0${file.size.toString()}\0${file.sha256 ?? ''}`;
        const rows = backendGroups.get(key) ?? [];
        rows.push(file);
        backendGroups.set(key, rows);
      }
      for (const rows of backendGroups.values()) {
        if (rows.length < 2) continue;
        rows.sort((a, b) => (a.googleDriveFileId === winner.id ? -1 : 0) - (b.googleDriveFileId === winner.id ? -1 : 0));
        for (const row of rows.slice(1)) {
          await this.prisma.file.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
          await this.sync.emitRemoteChange(profileId, { operation: SyncOperation.DELETE, fileId: row.id, relativePath: row.relativePath, name: row.name });
          backendFilesRemoved++;
        }
      }
    }

    const backendFolders = await this.prisma.folder.findMany({
      where: { ownerId: profileId, deletedAt: null },
      select: { id: true, name: true, parentFolderId: true, relativePath: true, googleDriveFolderId: true },
      orderBy: { createdAt: 'asc' },
    });
    const folderGroups = new Map<string, typeof backendFolders>();
    for (const folder of backendFolders) {
      const key = `${folder.parentFolderId ?? 'root'}\0${folder.name}`;
      const group = folderGroups.get(key) ?? [];
      group.push(folder);
      folderGroups.set(key, group);
    }
    for (const group of folderGroups.values()) {
      if (group.length < 2) continue;
      for (const duplicate of group.slice(1)) {
        const [childFolders, childFiles] = await Promise.all([
          this.prisma.folder.count({ where: { parentFolderId: duplicate.id, deletedAt: null } }),
          this.prisma.file.count({ where: { folderId: duplicate.id, deletedAt: null } }),
        ]);
        if (childFolders || childFiles) continue;
        await this.prisma.folder.update({ where: { id: duplicate.id }, data: { deletedAt: new Date() } });
        await this.sync.emitRemoteChange(profileId, { operation: SyncOperation.DELETE, folderId: duplicate.id, relativePath: duplicate.relativePath, name: duplicate.name });
        backendFoldersRemoved++;
      }
    }

    const driveFolderGroups = new Map<string, DedupeEntry[]>();
    for (const entry of entries.filter((item) => item.isFolder && item.name !== 'My Files')) {
      const key = `${entry.parentId}\0${entry.name}`;
      const group = driveFolderGroups.get(key) ?? [];
      group.push(entry);
      driveFolderGroups.set(key, group);
    }
    for (const group of driveFolderGroups.values()) {
      if (group.length < 2) continue;
      const nonEmpty = (candidate: DedupeEntry) => entries.some((entry) => entry.relativePath.startsWith(`${candidate.relativePath}/`));
      const empty = group.filter((candidate) => !nonEmpty(candidate));
      for (const duplicate of empty.slice(1)) {
        try {
          await trashDrive(duplicate.id);
          removedDriveIds.add(duplicate.id);
          driveItemsTrashed++;
        } catch (error) {
          this.logger.warn(`Could not trash duplicate Drive folder ${duplicate.id}: ${(error as Error).message}`);
        }
      }
    }

    return { removedDriveIds, backendFilesRemoved, backendFoldersRemoved, driveItemsTrashed };
  }
}
