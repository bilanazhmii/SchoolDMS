import api from '../lib/axios';
import type { ID } from '../types/explorer';

export type SharePermission = 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'COMMENT';

export interface ShareLink {
  id: ID;
  publicToken: string;
  permission: SharePermission;
  expiresAt: string | null;
  downloadLimit: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicShareFile {
  type: 'file';
  permission: SharePermission;
  expiresAt: string | null;
  downloadLimit: number;
  downloadCount: number;
  file: {
    id: ID;
    name: string;
    mimeType: string | null;
    size: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PublicShareFolder {
  type: 'folder';
  permission: SharePermission;
  expiresAt: string | null;
  folder: {
    id: ID;
    name: string;
    files: number;
    items: Array<{ id: ID; name: string; mimeType: string | null; size: number; updatedAt: string }>;
  };
}

function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    'data' in body &&
    (body as { success: boolean }).success
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function createShareLink(
  fileId: string,
  permission: SharePermission = 'VIEW',
): Promise<ShareLink> {
  const { data } = await api.post('/share-links', { fileId, permission });
  return unwrap(data);
}

export async function createFolderShareLink(
  folderId: string,
  permission: SharePermission = 'VIEW',
): Promise<ShareLink> {
  const { data } = await api.post('/share-links', { folderId, permission });
  return unwrap(data);
}

export async function fetchShare(
  token: string,
): Promise<PublicShareFile | PublicShareFolder> {
  const { data } = await api.get(`/share/${encodeURIComponent(token)}`);
  return unwrap(data);
}

export function shareDownloadUrl(token: string, fileId?: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const suffix = fileId ? `/download/${encodeURIComponent(fileId)}` : '/download';
  return `${base}/share/${encodeURIComponent(token)}${suffix}`;
}

export function sharePageUrl(token: string): string {
  return `/s/${encodeURIComponent(token)}`;
}
