import { Readable } from 'stream';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { IStorageService } from './storage.service.interface';

/**
 * Supabase Storage implementation of IStorageService.
 *
 * Files are stored in a bucket (`dms-files`) under the same relative paths
 * used by the local driver, so the rest of the system is unchanged. Supabase
 * Storage is free-tier friendly and survives restarts (unlike the ephemeral
 * disk on free hosting).
 */
@Injectable()
export class SupabaseStorageService implements IStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'dms-files';

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SupabaseStorageService',
      );
    }

    this.supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    void this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const { data, error } = await this.supabase.storage.getBucket(this.bucket);
      if (error || !data) {
        const { error: createError } = await this.supabase.storage.createBucket(
          this.bucket,
          { public: true },
        );
        if (createError) {
          this.logger.warn(
            `Failed to create storage bucket '${this.bucket}': ${createError.message}`,
          );
        } else {
          this.logger.log(`Storage bucket '${this.bucket}' created.`);
        }
      }
    } catch (e) {
      this.logger.warn(`ensureBucket failed: ${(e as Error).message}`);
    }
  }

  private cleanPath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\\/g, '/');
  }

  async upload(
    buffer: Buffer,
    path: string,
    contentType: string,
  ): Promise<string> {
    const key = this.cleanPath(path);
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(key, buffer, {
        contentType,
        upsert: true,
      });
    if (error) {
      this.logger.error(`Supabase upload failed: ${path}`, error);
      throw new Error(`Storage upload failed: ${path}`);
    }
    this.logger.debug(`File uploaded to Supabase: ${path}`);
    return path;
  }

  async download(path: string): Promise<Buffer> {
    const key = this.cleanPath(path);
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(key);
    if (error || !data) {
      this.logger.error(`Supabase download failed: ${path}`, error);
      throw new Error(`Storage download failed: ${path}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(path: string): Promise<void> {
    const key = this.cleanPath(path);
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);
    if (error) {
      this.logger.error(`Supabase delete failed: ${path}`, error);
      throw new Error(`Storage delete failed: ${path}`);
    }
  }

  async getStream(path: string): Promise<Readable> {
    const buffer = await this.download(path);
    return Readable.from(buffer);
  }

  async exists(path: string): Promise<boolean> {
    const key = this.cleanPath(path);
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list(key.split('/').slice(0, -1).join('/') || '.', {
        limit: 1,
        search: key.split('/').pop() ?? key,
      });
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  }

  getPublicUrl(path: string): string | null {
    const key = this.cleanPath(path);
    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(key);
    return data?.publicUrl ?? null;
  }
}
