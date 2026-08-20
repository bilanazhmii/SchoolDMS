import crypto from 'crypto';
import { Readable } from 'stream';
import { google } from 'googleapis';

import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedProfile } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { IStorageService } from '../storage/storage.service.interface';
import { STORAGE_SERVICE_TOKEN } from '../storage/storage.module';

const ALGORITHM = 'aes-256-gcm';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_ROOT_NAME = 'My Sync';

type DriveTreeEntry = {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime?: string | null;
  parentId: string;
  relativePath: string;
  isFolder: boolean;
};

@Injectable()
export class DriveService implements OnModuleInit {
  private readonly logger = new Logger(DriveService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: Buffer | null;
  private timer: NodeJS.Timeout | null = null;
  private pulling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_SERVICE_TOKEN) private readonly storage: IStorageService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_DRIVE_CLIENT_ID') ?? '';
    this.clientSecret =
      this.config.get<string>('GOOGLE_DRIVE_CLIENT_SECRET') ?? '';
    this.redirectUri =
      this.config.get<string>('GOOGLE_DRIVE_REDIRECT_URI') ?? '';

    const rawKey = this.config.get<string>('DRIVE_TOKEN_ENCRYPTION_KEY');
    this.encryptionKey = rawKey
      ? crypto.createHash('sha256').update(String(rawKey)).digest()
      : null;

    if (!this.isConfigured()) {
      this.logger.warn(
        'Google Drive is not configured (GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REDIRECT_URI / DRIVE_TOKEN_ENCRYPTION_KEY missing). Drive features are disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.redirectUri &&
        this.encryptionKey,
    );
  }

  /**
   * Automatic Drive -> backend pull every 10 minutes for every connected user,
   * so files changed on Google Drive appear in the web explorer without a
   * manual "Sync Drive" click.
   */
  onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Drive auto-pull disabled: Google Drive is not configured.',
      );
      return;
    }
    this.timer = setInterval(() => void this.autoPullAll(), 10 * 60 * 1000);
    this.timer.unref?.();
    this.logger.log(
      'Drive auto-pull scheduler enabled (every 10 minutes).',
    );
  }

  private async autoPullAll() {
    if (this.pulling) return;
    this.pulling = true;
    try {
      const accounts = await this.prisma.driveAccount.findMany({
        where: { connectionStatus: 'CONNECTED' },
        select: { profileId: true },
      });
      for (const account of accounts) {
        try {
          const pushed = await this.pushSync(account.profileId);
          const pulled = await this.pullSync(account.profileId);
          this.logger.log(
            `Auto-sync for ${account.profileId}: push=${JSON.stringify(pushed)} pull=${JSON.stringify(pulled)}`,
          );
        } catch (e) {
          this.logger.warn(
            `Auto-pull failed for ${account.profileId}: ${(e as Error).message}`,
          );
        }
      }
    } finally {
      this.pulling = false;
    }
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google Drive is not configured on this server',
      );
    }
  }

  private createOAuthClient() {
    this.requireConfigured();
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
  }

  getAuthUrl(profile: AuthenticatedProfile) {
    this.requireConfigured();
    const oauth2 = this.createOAuthClient();
    const scopes = [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive',
    ];

    const state = Buffer.from(profile.id).toString('base64');

    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });
  }

  private encryptToken(token: string) {
    this.requireConfigured();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      this.encryptionKey as Buffer,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decryptToken(encrypted: string) {
    this.requireConfigured();
    const [ivB64, tagB64, dataB64] = encrypted.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.encryptionKey as Buffer,
      iv,
    );
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  async handleOAuthCallback(code: string, state: string) {
    const oauth2 = this.createOAuthClient();
    const { tokens } = await oauth2.getToken(code);

    // state contains base64(profileId)
    const profileId = Buffer.from(state, 'base64').toString('utf8');
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      throw new Error('Profile not found for OAuth callback state');
    }

    if (!tokens.refresh_token) {
      // If no refresh token was returned, try to use existing record
      this.logger.warn(
        'No refresh token returned by Google; connection may already exist',
      );
    } else {
      const encrypted = this.encryptToken(tokens.refresh_token);

      // fetch userinfo to get googleUserId and email
      oauth2.setCredentials({ refresh_token: tokens.refresh_token });
      const oauth2Api = google.oauth2({ auth: oauth2, version: 'v2' });
      const userinfo = await oauth2Api.userinfo.get();
      const googleId = userinfo.data.id ?? '';
      const email = userinfo.data.email ?? '';

      // create or update DriveAccount (match by profileId)
      const existing = await this.prisma.driveAccount.findFirst({
        where: { profileId: profile.id },
      });
      if (existing) {
        await this.prisma.driveAccount.update({
          where: { id: existing.id },
          data: {
            googleUserId: googleId,
            email,
            refreshToken: encrypted,
            connectedAt: new Date(),
            connectionStatus: 'CONNECTED',
          },
        });
      } else {
        await this.prisma.driveAccount.create({
          data: {
            profileId: profile.id,
            googleUserId: googleId,
            email,
            refreshToken: encrypted,
            connectedAt: new Date(),
            connectionStatus: 'CONNECTED',
          },
        });
      }
    }

        void this.pushSync(profile.id).catch((error) => {
      this.logger.warn(`Initial Drive push failed for ${profile.id}: ${(error as Error).message}`);
    });
    return { success: true };
  }

  private async getRefreshTokenForProfile(profileId: string) {
    const account = await this.prisma.driveAccount.findFirst({
      where: { profileId },
    });
    if (!account || !account.refreshToken) return null;
    try {
      return this.decryptToken(account.refreshToken);
    } catch (e) {
      this.logger.error('Failed to decrypt refresh token', e as Error);
      return null;
    }
  }

  async getAccessTokenForProfile(profileId: string) {
    const refreshToken = await this.getRefreshTokenForProfile(profileId);
    if (!refreshToken) return null;

    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ refresh_token: refreshToken });

    // This call will use the refresh token to obtain a short-lived access token.
    const res = await oauth2.getAccessToken();
    if (!res.token) return null;
    return res.token;
  }

  async ensureFolderPathForProfile(profileId: string, relativeFilePath: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const rootFolderId = await this.ensureRootFolder(profileId, token);
    if (!rootFolderId) return null;

    const parts = relativeFilePath.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).slice(0, -1);
    let parentId = rootFolderId;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });

    for (const name of parts) {
      const existing = await drive.files.list({
        q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1,
      });
      const found = existing.data.files?.[0]?.id;
      if (found) {
        parentId = found;
        continue;
      }
      const created = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
      });
      if (!created.data.id) return null;
      parentId = created.data.id;
    }
    return parentId;
  }

  async createFolderForProfile(profileId: string, name: string, parentFolderId?: string | null) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const rootFolderId = parentFolderId ?? (await this.ensureRootFolder(profileId, token));
    if (!rootFolderId) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const escapedName = name.replace(/'/g, "\\'");
    const existing = await drive.files.list({
      q: `'${rootFolderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });
    if (existing.data.files?.[0]?.id) return existing.data.files[0].id;
    const created = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
      fields: 'id, name',
    });
    return created.data.id ?? null;
  }

  async uploadFileForProfile(
    profileId: string,
    file: { name: string; mimeType: string; buffer: Buffer },
    parentFolderId?: string | null,
    relativeFilePath?: string,
  ) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const targetFolderId = parentFolderId
      ?? (relativeFilePath
        ? await this.ensureFolderPathForProfile(profileId, relativeFilePath)
        : await this.ensureRootFolder(profileId, token));
    const result = await drive.files.create({
      requestBody: {
        name: file.name,
        mimeType: file.mimeType,
        ...(targetFolderId ? { parents: [targetFolderId] } : {}),
      },
      media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  }

  async updateFileForProfile(
    profileId: string,
    googleDriveFileId: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const result = await drive.files.update({
      fileId: googleDriveFileId,
      requestBody: { name: file.name, mimeType: file.mimeType },
      media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
      fields: 'id, name, mimeType, modifiedTime, webViewLink',
    });
    return result.data;
  }

  async renameFileForProfile(profileId: string, googleDriveFileId: string, name: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    return drive.files.update({ fileId: googleDriveFileId, requestBody: { name }, fields: 'id, name, modifiedTime' });
  }

  async moveFileForProfile(
    profileId: string,
    googleDriveFileId: string,
    parentFolderId: string | null,
  ) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const current = await drive.files.get({ fileId: googleDriveFileId, fields: 'parents' });
    const previousParents = (current.data.parents ?? []).join(',');
    const targetParent = parentFolderId ?? (await this.ensureRootFolder(profileId, token));
    return drive.files.update({
      fileId: googleDriveFileId,
      addParents: targetParent ?? undefined,
      removeParents: previousParents || undefined,
      requestBody: {},
      fields: 'id, parents, modifiedTime',
    });
  }

  async trashFileForProfile(profileId: string, googleDriveFileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    return drive.files.update({
      fileId: googleDriveFileId,
      requestBody: { trashed: true },
      fields: 'id, trashed, modifiedTime',
    });
  }

  async downloadFileForProfile(profileId: string, googleDriveFileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const result = await drive.files.get(
      { fileId: googleDriveFileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(result.data as ArrayBuffer);
  }

  private async ensureRootFolder(profileId: string, accessToken: string) {
    const account = await this.prisma.driveAccount.findFirst({ where: { profileId } });
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    if (account?.rootFolderId) {
      try {
        const stored = await drive.files.get({ fileId: account.rootFolderId, fields: 'id, name, mimeType, parents, trashed' });
        if (stored.data.name === DRIVE_ROOT_NAME && stored.data.mimeType === DRIVE_FOLDER_MIME && stored.data.trashed !== true && stored.data.parents?.includes('root')) return account.rootFolderId;
      } catch {
        // Find or create the canonical root below when the stored root is stale.
      }
    }
    const existing = await drive.files.list({
      q: `'root' in parents and name = '${DRIVE_ROOT_NAME}' and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1,
    });
    const folderId = existing.data.files?.[0]?.id ?? (await drive.files.create({
      requestBody: { name: DRIVE_ROOT_NAME, mimeType: DRIVE_FOLDER_MIME },
      fields: 'id',
    })).data.id;
    if (folderId && account) await this.prisma.driveAccount.update({ where: { id: account.id }, data: { rootFolderId: folderId } });
    return folderId ?? null;
  }

  async pushFoldersSync(profileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return { connected: false, created: 0, skipped: 0 };
    const rootFolderId = await this.ensureRootFolder(profileId, token);
    if (!rootFolderId) return { connected: true, created: 0, skipped: 0 };

    const folders = await this.prisma.folder.findMany({
      where: { ownerId: profileId, deletedAt: null },
      orderBy: { relativePath: 'asc' },
    });
    const driveIds = new Map<string, string>();
    let created = 0;
    let skipped = 0;
    for (const folder of folders) {
      try {
        const parentId = folder.parentFolderId
          ? driveIds.get(folder.parentFolderId) ?? (await this.prisma.folder.findUnique({ where: { id: folder.parentFolderId }, select: { googleDriveFolderId: true } }))?.googleDriveFolderId ?? rootFolderId
          : rootFolderId;
        const driveFolderId = folder.googleDriveFolderId ?? await this.createFolderForProfile(profileId, folder.name, parentId);
        if (folder.googleDriveFolderId) {
          await this.moveFileForProfile(profileId, folder.googleDriveFolderId, parentId);
        }
        if (!driveFolderId) {
          skipped++;
          continue;
        }
        driveIds.set(folder.id, driveFolderId);
        if (folder.googleDriveFolderId !== driveFolderId || folder.syncStatus !== 'SYNCED') {
          await this.prisma.folder.update({
            where: { id: folder.id },
            data: { googleDriveFolderId: driveFolderId, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
          });
          created++;
        }
      } catch (error) {
        skipped++;
        this.logger.warn(`Drive folder push skipped ${folder.id}: ${(error as Error).message}`);
      }
    }
    return { connected: true, created, skipped };
  }

  async pushSync(profileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return { connected: false, uploaded: 0, folders: 0, skipped: 0 };
    const folderResult = await this.pushFoldersSync(profileId);

    const files = await this.prisma.file.findMany({
      where: { ownerId: profileId, deletedAt: null, googleDriveFileId: null },
      orderBy: { updatedAt: 'asc' },
    });
    let uploaded = 0;
    let skipped = 0;

    for (const file of files) {
      try {
        const latest = await this.prisma.fileVersion.findFirst({
          where: { fileId: file.id },
          orderBy: { versionNumber: 'desc' },
        });
        if (!latest?.storagePath) {
          skipped++;
          continue;
        }
        const buffer = await this.storage.download(latest.storagePath);
        const folder = file.folderId
          ? await this.prisma.folder.findUnique({ where: { id: file.folderId } })
          : null;
        const driveFile = await this.uploadFileForProfile(
          profileId,
          { name: file.name, mimeType: file.mimeType, buffer },
          folder?.googleDriveFolderId,
          file.relativePath,
        );
        if (!driveFile?.id) {
          skipped++;
          continue;
        }
        await this.prisma.file.update({
          where: { id: file.id },
          data: { googleDriveFileId: driveFile.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
        });
        uploaded++;
      } catch (error) {
        skipped++;
        this.logger.warn(`Drive push skipped ${file.id}: ${(error as Error).message}`);
      }
    }
    return { connected: true, uploaded, folders: folderResult.created, skipped: skipped + folderResult.skipped };
  }

  private async listDriveTree(
    drive: ReturnType<typeof google.drive>,
    parentId: string,
    relativePrefix = '',
  ): Promise<DriveTreeEntry[]> {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      pageSize: 200,
    });
    const entries: DriveTreeEntry[] = [];
    for (const file of response.data.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) continue;
      const relativePath = relativePrefix ? `${relativePrefix}/${file.name}` : file.name;
      const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
      const entry: DriveTreeEntry = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        parentId,
        relativePath,
        isFolder,
      };
      entries.push(entry);
      if (isFolder) {
        entries.push(...await this.listDriveTree(drive, file.id, relativePath));
      }
    }
    return entries;
  }

  /**
   * Pull sync: Google Drive -> backend.
   * Lists files in the user's My Sync Drive folder, creates missing File records
   * (with content stored in backend storage) and, when the Drive file is newer,
   * adds a new version (last-write-wins conflict policy).
   */
  async pullSync(profileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return { connected: false };

    const rootFolderId = await this.ensureRootFolder(profileId, token);
    if (!rootFolderId) return { connected: true, folders: 0, created: 0, updated: 0, skipped: 0 };

    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const entries = await this.listDriveTree(drive, rootFolderId);
    const backendFolderIds = new Map<string, string>();
    let folderCount = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of entries.filter((item) => item.isFolder)) {
      try {
        const parentFolderId = entry.parentId === rootFolderId ? null : backendFolderIds.get(entry.parentId) ?? null;
        const relativePath = `/${entry.relativePath}`;
        const existingFolder = await this.prisma.folder.findFirst({
          where: { ownerId: profileId, OR: [{ googleDriveFolderId: entry.id }, { relativePath }] },
        });
        const folder = existingFolder
          ? await this.prisma.folder.update({
              where: { id: existingFolder.id },
              data: { name: entry.name, parentFolderId, relativePath, googleDriveFolderId: entry.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
            })
          : await this.prisma.folder.create({
              data: { name: entry.name, ownerId: profileId, parentFolderId, relativePath, googleDriveFolderId: entry.id, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
            });
        backendFolderIds.set(entry.id, folder.id);
        folderCount++;
      } catch (error) {
        skipped++;
        this.logger.warn(`pullSync folder skipped ${entry.name}: ${(error as Error).message}`);
      }
    }

    for (const entry of entries.filter((item) => !item.isFolder)) {
      try {
        const folderId = entry.parentId === rootFolderId ? null : backendFolderIds.get(entry.parentId) ?? null;
        const relativePath = `/${entry.relativePath}`;
        const existing = await this.prisma.file.findFirst({
          where: { ownerId: profileId, OR: [{ googleDriveFileId: entry.id }, { relativePath }] },
        });
        const buffer = await this.downloadDriveFile(drive, entry.id);
        if (!buffer) {
          skipped++;
          continue;
        }
        const mimeType = entry.mimeType || existing?.mimeType || 'application/octet-stream';
        const size = BigInt(Number(entry.size ?? buffer.length));
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        if (!existing) {
          const file = await this.prisma.file.create({
            data: { name: entry.name, ownerId: profileId, folderId, mimeType, size, relativePath, googleDriveFileId: entry.id, sha256, syncStatus: 'SYNCED', lastSyncedAt: new Date() },
          });
          const storagePath = `files/${file.id}/v1`;
          await this.storage.upload(buffer, storagePath, mimeType);
          await this.prisma.fileVersion.create({ data: { fileId: file.id, versionNumber: 1, size, mimeType, storagePath, sha256, syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
          created++;
          continue;
        }

        const driveModified = entry.modifiedTime ? new Date(entry.modifiedTime) : new Date(0);
        if (existing.sha256 === sha256 || driveModified <= existing.updatedAt) {
          await this.prisma.file.update({ where: { id: existing.id }, data: { name: entry.name, folderId, relativePath, googleDriveFileId: entry.id } });
          skipped++;
          continue;
        }

        const versionNumber = existing.versionNumber + 1;
        const storagePath = `files/${existing.id}/v${versionNumber}`;
        await this.storage.upload(buffer, storagePath, mimeType);
        await this.prisma.fileVersion.create({ data: { fileId: existing.id, versionNumber, size, mimeType, storagePath, sha256, syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
        await this.prisma.file.update({ where: { id: existing.id }, data: { name: entry.name, folderId, relativePath, googleDriveFileId: entry.id, versionNumber, size, sha256, syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
        updated++;
      } catch (error) {
        skipped++;
        this.logger.warn(`pullSync file skipped ${entry.name}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Drive pullSync for ${profileId}: ${folderCount} folders, ${created} created, ${updated} updated, ${skipped} skipped`);
    return { connected: true, folders: folderCount, created, updated, skipped };
  }

  private async downloadDriveFile(drive: ReturnType<typeof google.drive>, fileId: string): Promise<Buffer | null> {
    try {
      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      );
      return Buffer.from(res.data as ArrayBuffer);
    } catch (e) {
      this.logger.warn(`downloadDriveFile failed for ${fileId}: ${(e as Error).message}`);
      return null;
    }
  }

  async verifyConnection(profileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return { connected: false };

    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    try {
      const about = await drive.about.get({
        fields: 'user, storageQuota',
      });
      return { connected: true, about: about.data };
    } catch (e) {
      this.logger.warn('Drive API verification failed', e as Error);
      return { connected: false };
    }
  }

  async disconnect(profileId: string) {
    const account = await this.prisma.driveAccount.findFirst({
      where: { profileId },
    });
    if (!account) return { success: false };

    await this.prisma.driveAccount.update({
      where: { id: account.id },
      data: {
        refreshToken: null,
        disconnectedAt: new Date(),
        connectionStatus: 'DISCONNECTED',
      },
    });

    return { success: true };
  }

  async getDriveAccountInfo(profileId: string) {
    const account = await this.prisma.driveAccount.findFirst({
      where: { profileId },
    });
    if (!account) return null;
    return {
      id: account.id,
      email: account.email,
      googleUserId: account.googleUserId,
      connectedAt: account.connectedAt,
      disconnectedAt: account.disconnectedAt,
      connectionStatus: account.connectionStatus,
    };
  }
}
