import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SyncOperation, SyncStatus } from '@prisma/client';

export interface HeartbeatDto {
  deviceIdentifier: string;
  hostname?: string;
  machineName?: string;
  clientVersion?: string;
}

export interface SyncJobReportDto {
  sessionId: string;
  operation: SyncOperation;
  status: SyncStatus;
  filePath?: string;
  relativePath?: string;
  message?: string;
}

export interface RemoteChangeDto {
  operation: SyncOperation;
  fileId?: string | null;
  folderId?: string | null;
  relativePath?: string | null;
  oldRelativePath?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: bigint | number | null;
  sha256?: string | null;
}

@Injectable()
export class SyncStatusService {
  private readonly logger = new Logger(SyncStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async heartbeat(profileId: string, dto: HeartbeatDto) {
    if (!dto.deviceIdentifier) {
      return { sessionId: null };
    }

    const device = await this.prisma.device.upsert({
      where: { deviceIdentifier: dto.deviceIdentifier },
      update: {
        profileId,
        hostname: dto.hostname ?? null,
        machineName: dto.machineName ?? null,
        clientVersion: dto.clientVersion ?? null,
        platform: 'WINDOWS',
        status: 'ONLINE',
        lastSeen: new Date(),
      },
      create: {
        profileId,
        deviceIdentifier: dto.deviceIdentifier,
        hostname: dto.hostname ?? null,
        machineName: dto.machineName ?? null,
        clientVersion: dto.clientVersion ?? null,
        platform: 'WINDOWS',
        status: 'ONLINE',
        lastSeen: new Date(),
      },
    });

    // One active sync session per device.
    const session = await this.prisma.syncSession.upsert({
      where: { sessionKey: dto.deviceIdentifier },
      update: { status: 'ACTIVE', updatedAt: new Date() },
      create: {
        profileId,
        deviceId: device.id,
        sessionKey: dto.deviceIdentifier,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    return { sessionId: session.id, deviceId: device.id, now: new Date().toISOString() };
  }

  async reportJob(profileId: string, dto: SyncJobReportDto) {
    if (!dto.sessionId) {
      return { success: false };
    }

    const session = await this.prisma.syncSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session || session.profileId !== profileId) {
      return { success: false };
    }

    await this.prisma.syncJob.create({
      data: {
        sessionId: session.id,
        operation: dto.operation,
        status: dto.status,
        message: dto.message ?? null,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    return { success: true };
  }

  async emitRemoteChange(profileId: string, change: RemoteChangeDto) {
    return this.prisma.remoteChange.create({
      data: {
        profileId,
        operation: change.operation,
        fileId: change.fileId ?? null,
        folderId: change.folderId ?? null,
        relativePath: change.relativePath ?? null,
        oldRelativePath: change.oldRelativePath ?? null,
        name: change.name ?? null,
        mimeType: change.mimeType ?? null,
        size: change.size == null ? null : BigInt(change.size),
        sha256: change.sha256 ?? null,
      },
    });
  }

  async getRemoteChanges(profileId: string, since?: string, limit = 200) {
    const cursorLimit = new Date();
    let safeSince = new Date(0);
    let sinceId: string | null = null;
    if (since) {
      try {
        const parsed = JSON.parse(since) as { createdAt?: string; id?: string };
        if (parsed.createdAt) safeSince = new Date(parsed.createdAt);
        sinceId = parsed.id ?? null;
      } catch {
        safeSince = new Date(since);
      }
    }
    if (Number.isNaN(safeSince.getTime())) safeSince = new Date(0);

    const changes = await this.prisma.remoteChange.findMany({
      where: {
        profileId,
        createdAt: { lte: cursorLimit },
        OR: sinceId
          ? [{ createdAt: { gt: safeSince } }, { createdAt: safeSince, id: { gt: sinceId } }]
          : [{ createdAt: { gt: safeSince } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(500, Math.max(1, limit)),
    });
    const last = changes[changes.length - 1];
    return {
      // The cursor points to the last returned row, not the query timestamp.
      // Therefore a batch larger than the client page size cannot be skipped.
      cursor: last ? JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }) : JSON.stringify({ createdAt: cursorLimit.toISOString() }),
      changes: changes.map((change) => ({ ...change, size: change.size == null ? null : Number(change.size) })),
    };
  }

  async status(profileId: string) {
    const [devices, sessions, recentJobs, totals] = await Promise.all([
      this.prisma.device.findMany({
        where: { profileId },
        orderBy: { lastSeen: 'desc' },
        take: 10,
        select: {
          id: true,
          hostname: true,
          machineName: true,
          clientVersion: true,
          status: true,
          lastSeen: true,
          platform: true,
        },
      }),
      this.prisma.syncSession.findMany({
        where: { profileId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, sessionKey: true, status: true, startedAt: true, updatedAt: true },
      }),
      this.prisma.syncJob.findMany({
        where: { session: { profileId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          operation: true,
          status: true,
          message: true,
          createdAt: true,
          finishedAt: true,
          session: { select: { sessionKey: true } },
        },
      }),
      this.prisma.syncJob.aggregate({
        where: { session: { profileId } },
        _count: { _all: true },
      }),
    ]);

    const synced = await this.prisma.syncJob.count({
      where: { session: { profileId }, status: 'SYNCED' },
    });
    const failed = await this.prisma.syncJob.count({
      where: { session: { profileId }, status: 'FAILED' },
    });

    const lastSyncJob = await this.prisma.syncJob.findFirst({
      where: { session: { profileId }, status: 'SYNCED' },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });

    // Device is considered online when it reported within the last 2 minutes.
    const onlineWindow = new Date(Date.now() - 2 * 60 * 1000);
    const onlineDevices = devices.filter((d) => d.lastSeen && d.lastSeen >= onlineWindow);

    return {
      devices: devices.map((d) => ({
        ...d,
        online: Boolean(d.lastSeen && d.lastSeen >= onlineWindow),
      })),
      onlineCount: onlineDevices.length,
      sessions: sessions.map((s) => ({
        ...s,
        deviceLabel: s.sessionKey,
      })),
      recentJobs,
      totals: { all: totals._count._all, synced, failed },
      lastSyncAt: lastSyncJob?.finishedAt ?? null,
      generatedAt: new Date().toISOString(),
    };
  }
}
