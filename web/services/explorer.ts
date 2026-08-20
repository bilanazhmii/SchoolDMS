import api from '../lib/axios';
import type {
  FileItem,
  FileVersion,
  FolderItem,
} from '../types/explorer';

/**
 * Backend wraps every JSON response in `{ success, data }`.
 * Unwrap it so callers receive the payload directly.
 */
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

/** Map a Prisma File row to the frontend FileItem shape. */
export function mapFile(raw: Record<string, unknown>): FileItem {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    mimeType: (raw.mimeType as string) ?? null,
    size: raw.size != null ? Number(raw.size) : null,
    modifiedAt: (raw.updatedAt as string) ?? (raw.createdAt as string) ?? '',
    createdAt: (raw.createdAt as string) ?? '',
    folderId: (raw.folderId as string) ?? null,
    relativePath: (raw.relativePath as string) ?? null,
    extension: (raw.extension as string) ?? null,
    googleDriveFileId: (raw.googleDriveFileId as string) ?? null,
    syncStatus: (raw.syncStatus as string) ?? null,
    lastSyncedAt: (raw.lastSyncedAt as string) ?? null,
    favorite: Boolean(raw.favorite),
    trashed: Boolean(raw.deletedAt),
  };
}

/** Map a Prisma Folder row to the frontend FolderItem shape. */
export function mapFolder(raw: Record<string, unknown>): FolderItem {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    parentId: (raw.parentFolderId as string) ?? null,
    relativePath: (raw.relativePath as string) ?? null,
    googleDriveFolderId: (raw.googleDriveFolderId as string) ?? null,
    syncStatus: (raw.syncStatus as string) ?? null,
    createdAt: (raw.createdAt as string) ?? '',
  };
}

/** Map a Prisma FileVersion row to the frontend FileVersion shape. */
export function mapVersion(raw: Record<string, unknown>): FileVersion {
  return {
    id: String(raw.id),
    fileId: String(raw.fileId ?? ''),
    createdAt: (raw.createdAt as string) ?? '',
    size: raw.size != null ? Number(raw.size) : null,
    note: (raw.note as string) ?? null,
  };
}

function mapFileList(raw: unknown): FileItem[] {
  return Array.isArray(raw)
    ? raw.map((f) => mapFile(f as Record<string, unknown>))
    : [];
}

function mapFolderList(raw: unknown): FolderItem[] {
  return Array.isArray(raw)
    ? raw.map((f) => mapFolder(f as Record<string, unknown>))
    : [];
}

export async function fetchRootFolders(): Promise<FolderItem[]> {
  const { data } = await api.get('/folders/root');
  return mapFolderList(unwrap(data));
}

export async function fetchFolderContents(
  folderId?: string,
): Promise<{ folders: FolderItem[]; files: FileItem[] }> {
  const path = folderId
    ? `/folders/${folderId}/contents`
    : '/folders/root/contents';
  const { data } = await api.get(path);
  const payload = unwrap<{ folders?: unknown; files?: unknown }>(data);
  return {
    folders: mapFolderList(payload?.folders),
    files: mapFileList(payload?.files),
  };
}

export async function searchExplorer(
  q: string,
): Promise<(FileItem | FolderItem)[]> {
  const { data } = await api.get('/search', { params: { q } });
  const payload = unwrap<{ folders?: unknown; files?: unknown }>(data);
  return [...mapFolderList(payload?.folders), ...mapFileList(payload?.files)];
}

export async function uploadFiles(folderId: string | undefined, form: FormData) {
  const { data } = await api.post(
    `/files/upload${folderId ? `?folderId=${folderId}` : ''}`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return unwrap(data);
}

export async function createFolder(name: string, parentFolderId?: string) {
  const { data } = await api.post('/folders', { name, parentFolderId: parentFolderId ?? null });
  return unwrap(data);
}

export async function moveItem(itemId: string, toFolderId?: string) {
  const { data } = await api.post(`/files/${itemId}/move`, {
    toFolderId: toFolderId ?? null,
  });
  return unwrap(data);
}

export async function copyItem(itemId: string, toFolderId?: string) {
  const { data } = await api.post(`/files/${itemId}/copy`, {
    toFolderId: toFolderId ?? null,
  });
  return unwrap(data);
}

export async function deleteItem(itemId: string) {
  const { data } = await api.delete(`/files/${itemId}`);
  return unwrap(data);
}

export async function restoreItem(itemId: string) {
  const { data } = await api.post(`/files/${itemId}/restore`);
  return unwrap(data);
}

export async function fetchFile(id: string): Promise<FileItem> {
  const { data } = await api.get(`/files/${id}`);
  return mapFile(unwrap(data) as Record<string, unknown>);
}

export async function fetchVersions(fileId: string): Promise<FileVersion[]> {
  const { data } = await api.get(`/files/${fileId}/versions`);
  const payload = unwrap<unknown[]>(data);
  return Array.isArray(payload)
    ? payload.map((v) => mapVersion(v as Record<string, unknown>))
    : [];
}

export async function fetchPreviewUrl(fileId: string): Promise<{ url: string }> {
  const { data } = await api.get(`/files/${fileId}/preview`);
  const payload = unwrap<{ previewUrl?: string; streamUrl?: string }>(data);
  const url = payload?.previewUrl || payload?.streamUrl || `/files/${fileId}/stream`;
  return { url };
}
