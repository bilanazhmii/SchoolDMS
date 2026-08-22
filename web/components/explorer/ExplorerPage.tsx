"use client";

import React, { Suspense, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useExplorer } from '../../hooks/useExplorer';
import {
  ExplorerProvider,
  useExplorerContext,
} from '../../providers/explorer-provider';
import { copyFolder, copyItem, deleteFolder, deleteItem, fetchFolderContents, moveFolder, moveItem, renameFile, renameFolder } from '../../services/explorer';

import type { FileItem, FolderItem } from '../../types/explorer';
import Breadcrumb from '../breadcrumb';
import { Skeleton } from '../ui';
import FilePreviewPanel from './FilePreviewPanel';
import FolderTree from './FolderTree';
import GridView from './GridView';
import ListView from './ListView';
import MetadataPanel from './MetadataPanel';
import QRPanel from './QRPanel';
import ShareDialog from './ShareDialog';
import Toolbar from './Toolbar';
import VersionHistoryPanel from './VersionHistoryPanel';
import MoveDialog from './MoveDialog';

const confirmWebMutation = (description: string) => window.confirm(
  `Konfirmasi perubahan\n\n${description}\n\nPerubahan akan disimpan di web dan dikirim ke laptop yang terhubung. Lanjutkan?`,
);

const ExplorerInner: React.FC = () => {

  const { currentFolderId, setCurrentFolderId, previewFile, setPreviewFile, setSelection } = useExplorerContext();
  const { view } = useExplorer();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['explorer', 'contents', currentFolderId],
    queryFn: () => fetchFolderContents(currentFolderId ?? undefined),
    retry: 2,
  });

  const files = data?.files ?? [];
  const folders = data?.folders ?? [];

  const hasItems = files.length > 0 || folders.length > 0;

  const openFolder = (folder: FolderItem) => {
    setPreviewFile(null);
    setSelection([]);
    setCurrentFolderId(folder.id);
  };

  const handleAction = async (action: 'rename' | 'copy' | 'move' | 'delete', item: FileItem | FolderItem) => {
    const isFile = 'mimeType' in item;
    if (action === 'move') {
      setMoveTarget(item);
      return;
    }
        if (action === 'delete' && !confirmWebMutation(`Hapus ${item.name} dan pindahkan ke Trash`)) return;

    try {
      setActionBusy(true);
      setActionMessage(null);
      if (action === 'rename') {
        const nextName = window.prompt('Rename item', item.name);
                if (!nextName?.trim() || nextName.trim() === item.name) return;
        if (!confirmWebMutation(`Ubah nama ${item.name} menjadi ${nextName.trim()}`)) return;
        if (isFile) await renameFile(item.id, nextName.trim());

        else await renameFolder(item.id, nextName.trim());
            } else if (action === 'copy') {
        if (!confirmWebMutation(`Salin ${item.name} ke folder tujuan`)) return;
        if (isFile) await copyItem(item.id, currentFolderId ?? undefined);

        else await copyFolder(item.id);
      } else {
        if (isFile) await deleteItem(item.id);
        else await deleteFolder(item.id);
        setSelection([]);
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ['explorer', 'root-folders'] });
      setActionMessage({ type: 'success', text: `${item.name} ${action === 'copy' ? 'was copied' : action === 'delete' ? 'was moved to Trash' : 'was renamed'}.` });
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Action failed.' });
    } finally {
      setActionBusy(false);
    }
  };

  const confirmMove = async (destination: string | null) => {
    if (!moveTarget) return;
        const target = moveTarget;
    const isFile = 'mimeType' in target;
    if (!confirmWebMutation(`Pindahkan ${target.name} ke folder tujuan`)) return;
    try {

      setActionBusy(true);
      setActionMessage(null);
      if (isFile) await moveItem(target.id, destination ?? undefined);
      else await moveFolder(target.id, destination);
      setMoveTarget(null);
      setSelection([]);
      await refetch();
      qc.invalidateQueries({ queryKey: ['explorer', 'root-folders'] });
      setActionMessage({ type: 'success', text: `${target.name} was moved successfully.` });
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Move failed.' });
    } finally {
      setActionBusy(false);
    }
  };

  const [shareUrl, setShareUrl] = useState<string | undefined>(undefined);
  const [shareTarget, setShareTarget] = useState<{ fileId?: string; folderId?: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | FolderItem | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const openShareDialog = (item: FileItem | FolderItem) => {
    setShareUrl(undefined);
    setShareTarget('mimeType' in item ? { fileId: item.id, name: item.name } : { folderId: item.id, name: item.name });
  };

  return (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[220px_minmax(0,1fr)_360px]">
      {/* Folder tree */}
      <aside className="hidden min-w-0 border-r border-border bg-card lg:block">
        <FolderTree />
      </aside>

      {/* Main content */}
      <main className="min-w-0">

        <div className="border-b border-border px-4 py-3">
          <Breadcrumb
            items={[
              currentFolderId
                ? { label: 'My Sync', href: '/explorer' }
                : { label: 'My Sync' },
            ]}
                    />
          {!currentFolderId && <p className="mt-1 text-2xs text-foreground-faint">Root view shows core folders only. Uploads and new folders are placed inside My Files.</p>}
        </div>
        {actionMessage && <div className={actionMessage.type === 'success' ? 'mx-4 mt-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success' : 'mx-4 mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger'} role="status">{actionMessage.text}</div>}
        <Toolbar folderId={currentFolderId ?? undefined} items={[...folders, ...files]} />

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <LoadingState view={view} />
        ) : !hasItems ? (
          <EmptyState />
        ) : view === 'grid' ? (
          <GridView files={files} folders={folders} onOpenFolder={openFolder} onAction={handleAction} onShare={openShareDialog} />
        ) : (
          <ListView files={files} folders={folders} onOpenFolder={openFolder} onAction={handleAction} onShare={openShareDialog} />
        )}
      </main>

                  {/* Detail area: below the file list on smaller screens, fixed-width rail on wide screens. */}
      <section className="border-t border-border bg-card lg:hidden">
        <div className="p-4">
          <DetailPanel file={previewFile} fileUrl={shareUrl} />
        </div>
      </section>

      <aside className="hidden min-w-0 border-l border-border bg-card lg:block">
        <div className="sticky top-0 max-h-[calc(100vh-7rem)] overflow-y-auto p-4">
          <DetailPanel file={previewFile} fileUrl={shareUrl} />
        </div>
      </aside>

      <MoveDialog open={Boolean(moveTarget)} title={moveTarget ? `Move ${moveTarget.name}` : 'Move item'} onClose={() => { if (!actionBusy) setMoveTarget(null); }} onConfirm={confirmMove} busy={actionBusy} />
      <ShareDialog
        fileId={shareTarget?.fileId}
        folderId={shareTarget?.folderId}
        targetName={shareTarget?.name}
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        onCreated={(url) => setShareUrl(url)}
      />
    </div>
  );
};

function DetailPanel({ file, fileUrl }: { file?: FileItem | null; fileUrl?: string | null }) {
  if (!file) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-active px-6 py-10 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7.879a2.5 2.5 0 0 1 1.768.732l3.121 3.121A2.5 2.5 0 0 1 20 8.621V18.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 3.5V8h4.5M8 12h8M8 15.5h5" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-foreground">Detail file</h2>
        <p className="mt-1 max-w-xs text-xs leading-5 text-foreground-muted">Pilih file lalu buka dengan klik dua kali untuk melihat preview, metadata, versi, dan opsi share.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-active px-4 py-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-faint">Detail file</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground" title={file.relativePath ?? file.name}>{file.name}</p>
        <p className="mt-0.5 truncate text-2xs text-foreground-muted" title={file.relativePath ?? file.name}>{file.relativePath ?? file.name}</p>
      </div>
      <div className="rounded-xl border border-border bg-card"><FilePreviewPanel file={file} /></div>
      <div className="rounded-xl border border-border bg-card"><MetadataPanel fileId={file.id} /></div>
      <div className="rounded-xl border border-border bg-card"><VersionHistoryPanel fileId={file.id} /></div>
      <div className="rounded-xl border border-border bg-card"><QRPanel fileUrl={fileUrl} /></div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {

  return (
    <div className="p-12 text-center">
      <p className="text-sm text-foreground-muted mb-3">Unable to load folder contents.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-hover px-3 py-1.5 text-sm hover:bg-surface-active transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function LoadingState({ view }: { view: string }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <Skeleton className="h-14 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-4 w-full max-w-[200px] rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-active mx-auto mb-3">
        <svg className="h-5 w-5 text-foreground-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a4 4 0 018 0v4H8V5z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">No files</h3>
      <p className="text-2xs text-foreground-faint max-w-sm mx-auto">
        This folder is empty. Try uploading files or creating a new folder.
      </p>
    </div>
  );
}

const ExplorerPage: React.FC<{ initialFolderId?: string | null }> = ({
  initialFolderId,
}) => {
  return (
    <ExplorerProvider initialFolderId={initialFolderId}>
      <Suspense fallback={<LoadingState view="grid" />}>
        <ExplorerInner />
      </Suspense>
    </ExplorerProvider>
  );
};

export default ExplorerPage;
