import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let remoteChangeReady = false;
    try {
      await this.prisma.remoteChange.count();
      remoteChangeReady = true;
    } catch {
      remoteChangeReady = false;
    }
    return {
      status: 'ok',
      database: remoteChangeReady ? 'connected' : 'migration-required',
      remoteChangeReady,
      version: process.env.APP_VERSION ?? '2026-08-21-sync-stability-v6',
      timestamp: new Date().toISOString(),
    };
  }
}
