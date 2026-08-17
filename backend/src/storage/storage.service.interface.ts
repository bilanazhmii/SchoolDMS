import { Readable } from 'stream';

/**
 * Storage service interface for file operations.
 * Abstracts storage implementation to allow switching between
 * local filesystem, S3, Azure Blob, etc.
 */
export interface IStorageService {
  /**
   * Uploads a file buffer to storage.
   * @param buffer File content as buffer
   * @param path Storage path for the file
   * @param contentType MIME type of the file
   * @returns The actual storage path/URL
   */
  upload(buffer: Buffer, path: string, contentType: string): Promise<string>;

  /**
   * Downloads a file from storage.
   * @param path Storage path of the file
   * @returns File buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * Deletes a file from storage.
   * @param path Storage path of the file
   */
  delete(path: string): Promise<void>;

  /**
   * Gets a readable stream for a file (for large file downloads).
   * @param path Storage path of the file
   * @returns Readable stream
   */
  getStream(path: string): Promise<Readable>;

  /**
   * Checks if a file exists in storage.
   * @param path Storage path of the file
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Gets the public URL for a file (if applicable).
   * @param path Storage path of the file
   * @returns Public URL or null if not publicly accessible
   */
  getPublicUrl(path: string): string | null;
}
