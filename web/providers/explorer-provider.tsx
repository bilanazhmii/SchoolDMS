"use client";

import React, {
  createContext,
  useContext,
  useState,
} from 'react';

import type { FileItem } from '../types/explorer';

type ExplorerContextValue = {
  currentFolderId?: string | null;
  setCurrentFolderId: (id?: string | null) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  previewFile?: FileItem | null;
  setPreviewFile: (f?: FileItem | null) => void;
};

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function ExplorerProvider({
  children,
  initialFolderId,
}: {
  children: React.ReactNode;
  initialFolderId?: string | null;
}) {
  const [currentFolderId, setCurrentFolderIdState] = useState<string | null>(
    initialFolderId ?? null,
  );
  const [selection, setSelectionState] = useState<string[]>([]);
  const [previewFile, setPreviewFileState] = useState<FileItem | null>(null);

  const setCurrentFolderId = (id?: string | null) => setCurrentFolderIdState(id ?? null);
  const setSelection = (ids: string[]) => setSelectionState(ids);
  const setPreviewFile = (f?: FileItem | null) => setPreviewFileState(f ?? null);

  return (
    <ExplorerContext.Provider value={{ currentFolderId, setCurrentFolderId, selection, setSelection, previewFile, setPreviewFile }}>
      {children}
    </ExplorerContext.Provider>
  );
}

export function useExplorerContext() {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorerContext must be used within ExplorerProvider');
  return ctx;
}
