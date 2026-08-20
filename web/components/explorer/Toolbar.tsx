"use client";

import {
  FC,
  useCallback,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import { useQueryClient } from '@tanstack/react-query';

import { FolderPlus, LayoutGrid, List, RefreshCw, Search, Upload, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import api from '../../lib/axios';
import { useExplorer } from '../../hooks/useExplorer';
import {
  createFolder,
  searchExplorer,
  uploadFiles,
} from '../../services/explorer';

const Toolbar: FC<{ folderId?: string }> = ({ folderId }) => {
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const { view, setView, selected, clearSelection } = useExplorer();

  const handleSyncDrive = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await api.get('/drive/sync');
      const result = response.data?.data ?? response.data;
      const push = result?.push ?? {};
      const pull = result?.pull ?? {};
      setSyncMessage(`My Sync: ${push.folders ?? 0} folder, ${push.uploaded ?? 0} upload, ${pull.created ?? 0} masuk`);
      qc.invalidateQueries({ queryKey: ['explorer'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
      setSyncMessage('Drive belum tersambung atau sinkronisasi gagal.');

    } finally {
      setSyncing(false);
    }
  }, [qc]);

  const handleSearch = useCallback(() => {
    if (q.trim()) {
      router.push(`/explorer/search?q=${encodeURIComponent(q)}`);
    }
    qc.invalidateQueries({ queryKey: ['explorer', 'search'] });
  }, [q, router, qc]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const form = new FormData();
    for (const f of files) form.append('files', f);
    await uploadFiles(folderId, form);
    qc.invalidateQueries({ queryKey: ['explorer', 'contents', folderId] });
  }, [folderId, qc]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    await uploadFiles(folderId, form);
    e.target.value = '';
    qc.invalidateQueries({ queryKey: ['explorer', 'contents', folderId] });
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    await createFolder(name.trim(), folderId);
    qc.invalidateQueries({ queryKey: ['explorer', 'contents', folderId] });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
      {selected.length > 0 && <div className="flex shrink-0 items-center gap-2 rounded-md bg-primary-subtle px-2.5 py-1.5 text-xs text-primary"><span>{selected.length} selected</span><button type="button" onClick={clearSelection} aria-label="Clear selection" className="rounded p-0.5 hover:bg-primary/10"><X className="h-3.5 w-3.5" /></button></div>}
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files and folders..."
          className="w-full h-9 rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-md bg-surface-active p-1 border border-border">
        <button
          onClick={() => setView('grid')}
          className={cn(
            'p-1.5 rounded-sm text-sm transition-colors',
            view === 'grid'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
          )}
          aria-label="Grid view"
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setView('list')}
          className={cn(
            'p-1.5 rounded-sm text-sm transition-colors',
            view === 'list'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
          )}
          aria-label="List view"
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      <button onClick={handleNewFolder} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover" title="Create folder">
        <FolderPlus className="h-4 w-4" /> <span className="hidden sm:inline">New folder</span>
      </button>
      <button
        onClick={handleSyncDrive}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-60"
        title="Synchronize My Sync with connected Google Drive"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Drive'}</span>
            </button>
      {syncMessage && <span className="hidden xl:inline max-w-52 truncate text-2xs text-foreground-muted" title={syncMessage}>{syncMessage}</span>}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover" title="Upload files">
        <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Upload</span>
        <input type="file" multiple className="hidden" onChange={handleUpload} />
      </label>

      {/* Upload / drag-drop target */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-foreground-muted hover:border-primary hover:text-foreground transition-colors"
        title="Drag & drop files to upload"
      >
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Drop to upload</span>
      </div>
    </div>
  );
};

export default Toolbar;
