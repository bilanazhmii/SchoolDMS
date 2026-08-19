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
