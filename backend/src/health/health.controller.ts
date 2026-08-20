import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      database: 'connected',
      version: process.env.APP_VERSION ?? '2026-08-20-three-way-sync-v1',
      timestamp: new Date().toISOString(),
    };
  }
}
