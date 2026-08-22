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
  description: string | null;
  fileId?: ID | null;
  folderId?: ID | null;
}

export interface PublicShareFile {
  type: 'file';
  permission: SharePermission;
  expiresAt: string | null;
  downloadLimit: number;
  downloadCount: number;
  description: string | null;
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
  description: string | null;
  expiresAt: string | null;
  folder: {
    id: ID;
    name: string;
    files: number;
    folders: Array<{ id: ID; name: string; parentFolderId: ID | null; relativePath: string; createdAt: string }>;
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
  description?: string,
): Promise<ShareLink> {
  const { data } = await api.post('/share-links', { fileId, permission, description });
  return unwrap(data);
}

export async function createFolderShareLink(
  folderId: string,
  permission: SharePermission = 'VIEW',
  description?: string,
): Promise<ShareLink> {
  const { data } = await api.post('/share-links', { folderId, permission, description });
  return unwrap(data);
}

export async function fetchShare(
  token: string,
): Promise<PublicShareFile | PublicShareFolder> {
  const { data } = await api.get(`/share/${encodeURIComponent(token)}`);
  return unwrap(data);
}

export async function fetchSharedFolderContents(token: string, folderId?: string): Promise<PublicShareFolder> {
  const encodedToken = encodeURIComponent(token);
  const path = folderId
    ? `/share/${encodedToken}/contents/${encodeURIComponent(folderId)}`
    : `/share/${encodedToken}/contents`;
  const { data } = await api.get(path);
  return unwrap(data);
}

export async function fetchSharedText(token: string, fileId?: string): Promise<string> {
  const suffix = fileId ? `/preview/${encodeURIComponent(fileId)}` : '/preview';
  const response = await api.get(`/share/${encodeURIComponent(token)}${suffix}`, { responseType: 'text' });
  return response.data as string;
}

export async function saveSharedText(token: string, content: string, fileId?: string): Promise<unknown> {
  const { data } = await api.post(`/share/${encodeURIComponent(token)}/content`, { content, fileId });
  return unwrap(data);
}

function backendOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

export function shareDownloadUrl(token: string, fileId?: string): string {
  const base = backendOrigin();
  const suffix = fileId ? `/download/${encodeURIComponent(fileId)}` : '/download';
  return `${base}/share/${encodeURIComponent(token)}${suffix}`;
}

export function sharePreviewUrl(token: string, fileId?: string): string {
  const base = backendOrigin();
  const suffix = fileId ? `/preview/${encodeURIComponent(fileId)}` : '/preview';
  return `${base}/share/${encodeURIComponent(token)}${suffix}`;
}

export function sharePageUrl(token: string): string {
  return `/s/${encodeURIComponent(token)}`;
}
