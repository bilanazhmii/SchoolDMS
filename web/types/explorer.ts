export type ID = string;

export type FileItem = {
  id: ID;
  name: string;
  mimeType: string | null;
  size: number | null;
  modifiedAt: string;
  createdAt: string;
  folderId?: ID | null;
  relativePath?: string | null;
  extension?: string | null;
  googleDriveFileId?: string | null;
  syncStatus?: string | null;
  lastSyncedAt?: string | null;
  favorite?: boolean;
  trashed?: boolean;
};

export type FolderItem = {
  id: ID;
  name: string;
  parentId?: ID | null;
  relativePath?: string | null;
  googleDriveFolderId?: string | null;
  syncStatus?: string | null;
  createdAt: string;
};

export type FileVersion = {
  id: ID;
  fileId: ID;
  createdAt: string;
  size: number | null;
  note?: string | null;
};

export type ExplorerSort = 'name' | 'modified' | 'created' | 'size';
export type ExplorerView = 'grid' | 'list';
