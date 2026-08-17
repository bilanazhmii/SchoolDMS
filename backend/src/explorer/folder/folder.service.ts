import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto';

@Injectable()
export class FolderService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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
      folderId?: string;
      name?: { contains: string; mode: 'insensitive' };
    } = { ownerId: profileId, deletedAt: null };
    if (folderId) fileWhere.folderId = folderId;
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

    await this.audit.log(profileId, 'CREATE', 'FOLDER', folder.id, {
      name: folder.name,
    });
    return folder;
  }

  async update(profileId: string, id: string, dto: UpdateFolderDto) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId)
      throw new NotFoundException('Folder not found');

    const data: {
      name?: string;
      parentFolderId?: string | null;
      visibility?: 'PRIVATE' | 'RESTRICTED' | 'ORGANIZATION' | 'PUBLIC';
    } = {};
    if (dto.name) data.name = dto.name;
    if (dto.parentFolderId !== undefined)
      data.parentFolderId = dto.parentFolderId;
    if (dto.visibility)
      data.visibility = dto.visibility as
        'PRIVATE' | 'RESTRICTED' | 'ORGANIZATION' | 'PUBLIC';

    const updated = await this.prisma.folder.update({ where: { id }, data });
    await this.audit.log(profileId, 'UPDATE', 'FOLDER', id, { changes: data });
    return updated;
  }

  async softDelete(profileId: string, id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.ownerId !== profileId)
      throw new NotFoundException('Folder not found');
    if (folder.deletedAt)
      throw new BadRequestException('Folder already deleted');

    const deleted = await this.prisma.folder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
