import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

export const STORAGE_SERVICE_TOKEN = 'STORAGE_SERVICE';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE_TOKEN,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        if (driver === 'supabase') {
          return new SupabaseStorageService(config);
        }
        const storagePath = config.get<string>('STORAGE_PATH') || './storage';
        return new LocalStorageService(storagePath);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_SERVICE_TOKEN],
})
export class StorageModule {}
