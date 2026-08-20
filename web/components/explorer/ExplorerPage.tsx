"use client";

import React, { Suspense, useEffect, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useExplorer } from '../../hooks/useExplorer';
import {
  ExplorerProvider,
  useExplorerContext,
} from '../../providers/explorer-provider';
import { copyFolder, copyItem, deleteFolder, deleteItem, fetchFolderContents, moveFolder, moveItem, renameFile, renameFolder } from '../../services/explorer';
import { createShareLink, sharePageUrl } from '../../services/sharing';
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
    if (action === 'delete' && !window.confirm(`Delete ${item.name}?`)) return;
    try {
      setActionBusy(true);
      setActionMessage(null);
      if (action === 'rename') {
        const nextName = window.prompt('Rename item', item.name);
        if (!nextName?.trim() || nextName.trim() === item.name) return;
        if (isFile) await renameFile(item.id, nextName.trim());
        else await renameFolder(item.id, nextName.trim());
      } else if (action === 'copy') {
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

  useEffect(() => {
    let cancelled = false;
    if (!previewFile?.id) {
      setShareUrl(undefined);
      return;
    }
    createShareLink(previewFile.id, 'VIEW')
      .then((link) => {
        if (cancelled) return;
        const path = sharePageUrl(link.publicToken);
        setShareUrl(`${window.location.origin}${path}`);
      })
      .catch(() => {
        if (!cancelled) setShareUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [previewFile?.id]);

  return (
    <div className="grid grid-cols-12 gap-0">
      {/* Folder tree */}
      <aside className="hidden sm:block sm:col-span-3 lg:col-span-2 border-r border-border bg-card">
        <FolderTree />
      </aside>

      {/* Main content */}
      <main className="col-span-12 sm:col-span-9 lg:col-span-8">
        <div className="border-b border-border px-4 py-3">
          <Breadcrumb
            items={[
              currentFolderId
                ? { label: 'My Sync', href: '/explorer' }
                : { label: 'My Sync' },
            ]}
          />
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
          <GridView files={files} folders={folders} onOpenFolder={openFolder} onAction={handleAction} onShare={(item) => setShareTarget('mimeType' in item ? { fileId: item.id, name: item.name } : { folderId: item.id, name: item.name })} />
        ) : (
          <ListView files={files} folders={folders} onOpenFolder={openFolder} onAction={handleAction} onShare={(item) => setShareTarget('mimeType' in item ? { fileId: item.id, name: item.name } : { folderId: item.id, name: item.name })} />
        )}
      </main>

      {/* Right preview/metadata panels */}
      <aside className="hidden lg:block lg:col-span-2 xl:col-span-3 border-l border-border bg-card">
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="rounded-lg border border-border bg-card p-4">
            <FilePreviewPanel file={previewFile} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <MetadataPanel fileId={previewFile?.id} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <VersionHistoryPanel fileId={previewFile?.id} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <QRPanel fileUrl={shareUrl} />
          </div>
        </div>
      </aside>
      <MoveDialog open={Boolean(moveTarget)} title={moveTarget ? `Move ${moveTarget.name}` : 'Move item'} onClose={() => { if (!actionBusy) setMoveTarget(null); }} onConfirm={confirmMove} busy={actionBusy} />
      <ShareDialog
        fileId={shareTarget?.fileId}
        folderId={shareTarget?.folderId}
        targetName={shareTarget?.name}
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
      />
    </div>
  );
};

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
