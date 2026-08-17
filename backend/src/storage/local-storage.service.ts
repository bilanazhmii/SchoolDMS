import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdir, stat } from 'fs/promises';
import { Logger } from '@nestjs/common';

import { IStorageService } from './storage.service.interface';

/**
 * Local filesystem storage implementation.
 * Stores files in a configurable local directory.
 */
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    void this.ensureBaseDirectory();
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      this.logger.log(`Storage directory ensured: ${this.basePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to create storage directory: ${this.basePath}`,
        error,
      );
      throw error;
    }
  }

  private getFullPath(relativePath: string): string {
    // Prevent path traversal attacks
    const normalizedPath = relativePath
      .replace(/\.\./g, '')
      .replace(/\\/g, '/');
    return join(this.basePath, normalizedPath);
  }

  private async ensureDirectoryExists(fullPath: string): Promise<void> {
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async upload(
    buffer: Buffer,
    path: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _contentType: string,
  ): Promise<string> {
    const fullPath = this.getFullPath(path);
    await this.ensureDirectoryExists(fullPath);

    try {
      await fs.writeFile(fullPath, buffer);
      this.logger.debug(`File uploaded: ${path}`);
      return path;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${path}`, error);
      throw new Error(`Storage upload failed: ${path}`);
    }
  }

  async download(path: string): Promise<Buffer> {
    const fullPath = this.getFullPath(path);

    try {
      const buffer = await fs.readFile(fullPath);
      this.logger.debug(`File downloaded: ${path}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file: ${path}`, error);
      throw new Error(`Storage download failed: ${path}`);
    }
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);

    try {
      await fs.unlink(fullPath);
      this.logger.debug(`File deleted: ${path}`);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete file: ${path}`, error);
        throw new Error(`Storage delete failed: ${path}`);
      }
    }
  }

  async getStream(path: string): Promise<Readable> {
    const fullPath = this.getFullPath(path);

    try {
      const { createReadStream } = await import('fs');
      const stream = createReadStream(fullPath);
      this.logger.debug(`Stream created for: ${path}`);
      return stream;
    } catch (error) {
      this.logger.error(`Failed to create stream for: ${path}`, error);
      throw new Error(`Storage stream failed: ${path}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);

    try {
      await stat(fullPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPublicUrl(_path: string): string | null {
    // Local storage doesn't have public URLs by default
    // This would require a static file server
    return null;
  }
}
