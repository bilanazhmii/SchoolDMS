import { FC, useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Copy, FolderPlus, LayoutGrid, List, Move, RefreshCw, Search, Trash2, Upload, X, Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';
import api from '../../lib/axios';
import { useExplorer } from '../../hooks/useExplorer';
import { copyFolder, copyItem, createFolder, deleteFolder, deleteItem, deleteItems, moveFolder, moveItem, searchExplorer, uploadFiles } from '../../services/explorer';
import type { FileItem, FolderItem } from '../../types/explorer';
import MoveDialog from './MoveDialog';

type ExplorerItem = FileItem | FolderItem;
type Status = { type: 'success' | 'error'; text: string } | null;

const Toolbar: FC<{ folderId?: string; items: ExplorerItem[] }> = ({ folderId, items }) => {
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [moveOpen, setMoveOpen] = useState(false);
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
    setStatus(null);
    try {
      const response = await api.get('/drive/sync');
      const result = response.data?.data ?? response.data;
      const push = result?.push ?? {};
      const pull = result?.pull ?? {};
      setSyncMessage(`My Sync: ${push.folders ?? 0} folders, ${push.uploaded ?? 0} uploaded, ${pull.created ?? 0} received`);
      setStatus({ type: 'success', text: 'Google Drive sync completed.' });
      refresh();
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Drive sync failed.' });
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const targets = items.filter((item) => selected.includes(item.id));

  const executeBulk = useCallback(async (action: 'copy' | 'delete' | 'move', destination?: string | null) => {
    if (!targets.length) return;
    if (action === 'delete' && !window.confirm(`Move ${targets.length} selected item(s) to Trash?`)) return;
    try {
      setBusy(true);
      setStatus(null);
      if (action === 'delete') {
        const fileIds = targets.filter((item): item is FileItem => 'mimeType' in item).map((item) => item.id);
        const folderTargets = targets.filter((item): item is FolderItem => !('mimeType' in item));
        const result = fileIds.length ? await deleteItems(fileIds) : { deleted: 0, missing: [] as string[] };
        if (folderTargets.length) await Promise.all(folderTargets.map((folder) => deleteFolder(folder.id)));
        clearSelection();
        refresh();
        const missingText = result.missing.length ? ` ${result.missing.length} item(s) were already missing.` : '';
        setStatus({ type: 'success', text: `${result.deleted + folderTargets.length} item(s) moved to Trash.${missingText}` });
      } else {
        await Promise.all(targets.map((item) => {
          const isFile = 'mimeType' in item;
          if (action === 'copy') return isFile ? copyItem(item.id, folderId) : copyFolder(item.id);
          return isFile ? moveItem(item.id, destination ?? undefined) : moveFolder(item.id, destination ?? null);
        }));
        clearSelection();
        refresh();
        setStatus({ type: 'success', text: `${targets.length} item(s) ${action === 'copy' ? 'copied' : 'moved'}.` });
      }
      if (action === 'move') setMoveOpen(false);
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Bulk action failed.' });
    } finally {
      setBusy(false);
    }
  }, [clearSelection, folderId, refresh, targets]);

  const handleBulk = (action: 'copy' | 'delete' | 'move') => {
    if (!targets.length) return;
    if (action === 'move') {
      setMoveOpen(true);
      return;
    }
    void executeBulk(action);
  };

  const handleSelectAll = () => setSelection(allSelected ? [] : items.map((item) => item.id));

  const handleSearch = useCallback(() => {
    if (q.trim()) router.push(`/explorer/search?q=${encodeURIComponent(q)}`);
    qc.invalidateQueries({ queryKey: ['explorer', 'search'] });
  }, [q, router, qc]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    try {
      setBusy(true);
      setStatus(null);
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      await uploadFiles(folderId, form);
      refresh();
      setStatus({ type: 'success', text: `${files.length} file(s) uploaded${folderId ? '.' : ' to My Files.'}` });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Upload failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    await upload(Array.from(e.dataTransfer.files));
  }, [folderId, refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await upload(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    try {
      setBusy(true);
      await createFolder(name.trim(), folderId);
      refresh();
      setStatus({ type: 'success', text: `Folder “${name.trim()}” created${folderId ? '.' : ' inside My Files.'}` });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : 'Folder creation failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSelectAll} disabled={!items.length || busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40" title={allSelected ? 'Clear selection' : 'Select all visible items'}>
              <CheckSquare className="h-4 w-4" />
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
            {selected.length > 0 && (
              <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary-subtle px-2 py-1 text-xs font-medium text-primary">
                <span>{selected.length} selected</span>
                <button type="button" onClick={clearSelection} aria-label="Clear selection" className="rounded p-0.5 hover:bg-primary/10"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            {selected.length > 0 && (
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface-active p-1">
                <button type="button" disabled={busy} onClick={() => handleBulk('copy')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover disabled:opacity-50" title="Copy selected"><Copy className="h-3.5 w-3.5" />Copy</button>
                <button type="button" disabled={busy} onClick={() => handleBulk('move')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover disabled:opacity-50" title="Move selected"><Move className="h-3.5 w-3.5" />Move</button>
                <button type="button" disabled={busy} onClick={() => handleBulk('delete')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50" title="Delete selected"><Trash2 className="h-3.5 w-3.5" />Delete</button>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <div className="relative min-w-[220px] flex-1 xl:max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }} placeholder="Search files and folders..." className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface-active p-1" aria-label="View mode">
              <button type="button" onClick={() => setView('grid')} className={cn('rounded-sm p-1.5', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:bg-surface-hover')} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" onClick={() => setView('list')} className={cn('rounded-sm p-1.5', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:bg-surface-hover')} aria-label="List view"><List className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={handleNewFolder} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-50" title={folderId ? 'Create folder here' : 'Create folder inside My Files'}><FolderPlus className="h-4 w-4" /><span>New folder</span></button>
            <button type="button" onClick={handleSyncDrive} disabled={syncing || busy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-60" title="Synchronize My Sync with Google Drive"><RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} /><span>{syncing ? 'Syncing…' : 'Sync Drive'}</span></button>
            <label className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover', busy && 'pointer-events-none opacity-50')} title={folderId ? 'Upload files here' : 'Upload files to My Files'}><Upload className="h-4 w-4" /><span>Upload</span><input type="file" multiple className="hidden" onChange={handleUpload} /></label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:border-primary hover:text-foreground" title="Drag and drop files to upload">
            <Upload className="h-4 w-4" />
            <span>Drop files here to upload</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground-faint">
            {busy && <><Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Operation in progress" /><span>Working…</span></>}
            {!busy && <span>{items.length} visible item{items.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
      </div>
      {(status || syncMessage) && <div className={cn('mx-4 mt-3 rounded-md border px-3 py-2 text-xs', status?.type === 'error' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-success/30 bg-success/10 text-success')} role="status">{status?.text ?? syncMessage}</div>}
      <MoveDialog open={moveOpen} title={`Move ${targets.length} selected item(s)`} onClose={() => { if (!busy) setMoveOpen(false); }} onConfirm={(destination) => void executeBulk('move', destination)} busy={busy} />
    </>
  );
};

export default Toolbar;
