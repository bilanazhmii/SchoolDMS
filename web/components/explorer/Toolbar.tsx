"use client";

import { FC, useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Copy, FolderPlus, LayoutGrid, List, Move, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import api from '../../lib/axios';
import { useExplorer } from '../../hooks/useExplorer';
import { copyFolder, copyItem, createFolder, deleteFolder, deleteItem, moveFolder, moveItem, searchExplorer, uploadFiles } from '../../services/explorer';
import type { FileItem, FolderItem } from '../../types/explorer';

type ExplorerItem = FileItem | FolderItem;

const Toolbar: FC<{ folderId?: string; items: ExplorerItem[] }> = ({ folderId, items }) => {
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const { view, setView, selected, setSelection, clearSelection } = useExplorer();
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['explorer'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }, [qc]);

  const handleSyncDrive = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await api.get('/drive/sync');
      const result = response.data?.data ?? response.data;
      const push = result?.push ?? {};
      const pull = result?.pull ?? {};
      setSyncMessage(`My Sync: ${push.folders ?? 0} folder, ${push.uploaded ?? 0} upload, ${pull.created ?? 0} masuk`);
      refresh();
    } catch {
      setSyncMessage('Drive belum tersambung atau sinkronisasi gagal.');
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const handleBulk = useCallback(async (action: 'copy' | 'delete' | 'move') => {
    const targets = items.filter((item) => selected.includes(item.id));
    if (!targets.length) return;
    if (action === 'delete' && !window.confirm(`Delete ${targets.length} selected item(s)?`)) return;
    let destination: string | null = null;
    if (action === 'move') destination = window.prompt('Destination folder ID. Leave empty to move to My Sync root.')?.trim() || null;
    try {
      await Promise.all(targets.map((item) => {
        const isFile = 'mimeType' in item;
        if (action === 'copy') return isFile ? copyItem(item.id, folderId) : copyFolder(item.id);
        if (action === 'move') return isFile ? moveItem(item.id, destination || undefined) : moveFolder(item.id, destination);
        return isFile ? deleteItem(item.id) : deleteFolder(item.id);
      }));
      clearSelection();
      refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Bulk action failed');
    }
  }, [clearSelection, folderId, items, refresh, selected]);

  const handleSelectAll = () => setSelection(allSelected ? [] : items.map((item) => item.id));

  const handleSearch = useCallback(() => {
    if (q.trim()) router.push(`/explorer/search?q=${encodeURIComponent(q)}`);
    qc.invalidateQueries({ queryKey: ['explorer', 'search'] });
  }, [q, router, qc]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    const form = new FormData();
    dropped.forEach((file) => form.append('files', file));
    await uploadFiles(folderId, form);
    refresh();
  }, [folderId, refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = Array.from(e.target.files ?? []);
    if (!uploaded.length) return;
    const form = new FormData();
    uploaded.forEach((file) => form.append('files', file));
    await uploadFiles(folderId, form);
    e.target.value = '';
    refresh();
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    await createFolder(name.trim(), folderId);
    refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
      <button type="button" onClick={handleSelectAll} disabled={!items.length} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40" title={allSelected ? 'Clear selection' : 'Select all visible items'}><CheckSquare className="h-4 w-4" />{allSelected ? 'Clear all' : 'Select all'}</button>
      {selected.length > 0 && <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary-subtle px-2 py-1 text-xs font-medium text-primary"><span>{selected.length} selected</span><button type="button" onClick={clearSelection} aria-label="Clear selection" className="rounded p-0.5 hover:bg-primary/10"><X className="h-3.5 w-3.5" /></button></div>}
      {selected.length > 0 && <div className="flex items-center gap-1 rounded-md border border-border bg-surface-active p-1"><button type="button" onClick={() => handleBulk('copy')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover" title="Copy selected"><Copy className="h-3.5 w-3.5" />Copy</button><button type="button" onClick={() => handleBulk('move')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover" title="Move selected"><Move className="h-3.5 w-3.5" />Move</button><button type="button" onClick={() => handleBulk('delete')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-danger hover:bg-danger/10" title="Delete selected"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}
      <div className="relative min-w-[180px] flex-1"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }} placeholder="Search files and folders..." className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary" /></div>
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface-active p-1"><button type="button" onClick={() => setView('grid')} className={cn('rounded-sm p-1.5', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:bg-surface-hover')} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button><button type="button" onClick={() => setView('list')} className={cn('rounded-sm p-1.5', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:bg-surface-hover')} aria-label="List view"><List className="h-4 w-4" /></button></div>
      <button type="button" onClick={handleNewFolder} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover" title="Create folder"><FolderPlus className="h-4 w-4" /><span className="hidden sm:inline">New folder</span></button>
      <button type="button" onClick={handleSyncDrive} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-60" title="Synchronize My Sync with Google Drive"><RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} /><span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Drive'}</span></button>
      {syncMessage && <span className="max-w-56 truncate text-2xs text-foreground-muted" title={syncMessage}>{syncMessage}</span>}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover" title="Upload files"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Upload</span><input type="file" multiple className="hidden" onChange={handleUpload} /></label>
      <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="hidden items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-foreground-muted hover:border-primary hover:text-foreground sm:flex" title="Drag and drop files to upload"><Upload className="h-4 w-4" /><span className="hidden lg:inline">Drop to upload</span></div>
    </div>
  );
};

export default Toolbar;
