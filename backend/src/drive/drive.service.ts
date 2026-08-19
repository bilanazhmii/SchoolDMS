import crypto from 'crypto';
import { Readable } from 'stream';
import { google } from 'googleapis';

import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedProfile } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { IStorageService } from '../storage/storage.service.interface';
import { STORAGE_SERVICE_TOKEN } from '../storage/storage.module';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly encryptionKey: Buffer | null;

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

  async uploadFileForProfile(
    profileId: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return null;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const rootFolderId = await this.ensureRootFolder(profileId, token);
    const result = await drive.files.create({
      requestBody: {
        name: file.name,
        mimeType: file.mimeType,
        ...(rootFolderId ? { parents: [rootFolderId] } : {}),
      },
      media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
      fields: 'id, name, webViewLink',
    });
    return result.data;
  }

  private async ensureRootFolder(profileId: string, accessToken: string) {
    const account = await this.prisma.driveAccount.findFirst({ where: { profileId } });
    if (account?.rootFolderId) return account.rootFolderId;
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const existing = await drive.files.list({
      q: "name = 'SchoolDMS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id)',
      pageSize: 1,
    });
    const folderId = existing.data.files?.[0]?.id ?? (await drive.files.create({
      requestBody: { name: 'SchoolDMS', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    })).data.id;
    if (folderId && account) await this.prisma.driveAccount.update({ where: { id: account.id }, data: { rootFolderId: folderId } });
    return folderId ?? null;
  }

  /**
   * Pull sync: Google Drive -> backend.
   * Lists files in the user's SchoolDMS Drive folder, creates missing File records
   * (with content stored in backend storage) and, when the Drive file is newer,
   * adds a new version (last-write-wins conflict policy).
   */
  async pullSync(profileId: string) {
    const token = await this.getAccessTokenForProfile(profileId);
    if (!token) return { connected: false };

    const rootFolderId = await this.ensureRootFolder(profileId, token);
    if (!rootFolderId) return { connected: true, created: 0, updated: 0, skipped: 0 };

    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2 });

    const res = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      pageSize: 200,
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue;
      try {
        const existing = await this.prisma.file.findFirst({
          where: { ownerId: profileId, googleDriveFileId: f.id },
        });

        if (!existing) {
          const buffer = await this.downloadDriveFile(drive, f.id);
          if (!buffer) {
            skipped++;
            continue;
          }
          const mimeType = f.mimeType ?? 'application/octet-stream';
          const size = BigInt(Number(f.size ?? buffer.length));
          const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

          const file = await this.prisma.file.create({
            data: {
              name: f.name,
              ownerId: profileId,
              mimeType,
              size,
              relativePath: `/${f.name}`,
              googleDriveFileId: f.id,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date(),
            },
          });

          const storagePath = `files/${file.id}/v1`;
          await this.storage.upload(buffer, storagePath, mimeType);
          await this.prisma.fileVersion.create({
            data: {
              fileId: file.id,
              versionNumber: 1,
              size,
              mimeType,
              storagePath,
              sha256,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date(),
            },
          });
          created++;
          continue;
        }

        const driveModified = f.modifiedTime ? new Date(f.modifiedTime) : new Date(0);
        if (driveModified <= existing.updatedAt) {
          skipped++;
          continue;
        }

        // Last-write-wins: Drive file is newer -> new version in backend.
        const buffer = await this.downloadDriveFile(drive, f.id);
        if (!buffer) {
          skipped++;
          continue;
        }
        const mimeType = f.mimeType ?? existing.mimeType;
        const size = BigInt(Number(f.size ?? buffer.length));
        const versionNumber = existing.versionNumber + 1;
        const storagePath = `files/${existing.id}/v${versionNumber}`;
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        await this.storage.upload(buffer, storagePath, mimeType);
        await this.prisma.fileVersion.create({
          data: {
            fileId: existing.id,
            versionNumber,
            size,
            mimeType,
            storagePath,
            sha256,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        await this.prisma.file.update({
          where: { id: existing.id },
          data: {
            versionNumber,
            size,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } catch (e) {
        this.logger.warn(`pullSync skipped ${f.name}: ${(e as Error).message}`);
        skipped++;
      }
    }

    this.logger.log(`Drive pullSync for ${profileId}: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { connected: true, created, updated, skipped };
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
