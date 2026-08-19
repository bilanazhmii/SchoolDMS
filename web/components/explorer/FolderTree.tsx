"use client";

import { FC, useCallback, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { ChevronDown, Folder, FolderOpen, Home } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useExplorerContext } from '../../providers/explorer-provider';
import { fetchFolderContents, fetchRootFolders } from '../../services/explorer';
import type { FolderItem } from '../../types/explorer';
import { Skeleton } from '../ui';

const FolderTree: FC = () => {
  const { currentFolderId, setCurrentFolderId, setPreviewFile } = useExplorerContext();
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const { data: rootFolders = [], isLoading: rootLoading } = useQuery({
    queryKey: ['explorer', 'root-folders'],
    queryFn: fetchRootFolders,
  });

  const goHome = useCallback(() => {
    setPreviewFile(null);
    setCurrentFolderId(null);
  }, [setCurrentFolderId, setPreviewFile]);

  const openFolder = useCallback(
    (id: string) => {
      setPreviewFile(null);
      setCurrentFolderId(id);
    },
    [setCurrentFolderId, setPreviewFile],
  );

  const toggle = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="p-3 overflow-y-auto">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
        <Folder className="h-4 w-4 text-foreground-faint" />
        <span className="text-2xs font-medium uppercase tracking-wider text-foreground-faint">Folders</span>
      </div>
      <button
        type="button"
        onClick={goHome}
        className={cn(
          'mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          !currentFolderId
            ? 'bg-primary-subtle text-primary font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
        )}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span>My Files</span>
      </button>
      <div className="space-y-0.5">
        {rootLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded" />
            ))}
          </div>
        ) : (
          rootFolders.map((f: FolderItem) => {
            const open = openFolders.has(f.id);
            const active = currentFolderId === f.id;
            return (
              <div key={f.id}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    className="p-0.5 rounded hover:bg-surface-hover transition-colors"
                    aria-label={open ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-foreground-faint transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openFolder(f.id)}
                    className={cn(
                      'flex items-center gap-1.5 py-1.5 text-sm rounded-md transition-colors flex-1 truncate text-left',
                      active
                        ? 'bg-primary-subtle text-primary font-medium'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
                    )}
                  >
                    {open ? (
                      <FolderOpen className="h-4 w-4 shrink-0" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </button>
                </div>
                {open && (
                  <div className="ml-4 border-l border-border-subtle">
                    <FolderTreeSub
                      parent={f}
                      openFolders={openFolders}
                      toggle={toggle}
                      currentFolderId={currentFolderId}
                      openFolder={openFolder}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface FolderTreeSubProps {
  parent: FolderItem;
  openFolders: Set<string>;
  toggle: (id: string) => void;
  currentFolderId?: string | null;
  openFolder: (id: string) => void;
}

function FolderTreeSub({
  parent,
  openFolders,
  toggle,
  currentFolderId,
  openFolder,
}: FolderTreeSubProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['explorer', 'subfolders', parent.id],
    queryFn: () => fetchFolderContents(parent.id).then((d) => d.folders ?? []),
    enabled: openFolders.has(parent.id),
    staleTime: 30000,
  });

  const subFolders: FolderItem[] = data ?? [];
  if (!openFolders.has(parent.id)) return null;

  return (
    <div className="py-1 space-y-0.5">
      {isLoading && (
        <div className="space-y-1 pl-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-[calc(100%-1rem)] rounded" />
          ))}
        </div>
      )}
      {subFolders.map((f: FolderItem) => {
        const subOpen = openFolders.has(f.id);
        const active = currentFolderId === f.id;
        return (
          <div key={f.id}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(f.id)}
                className="p-0.5 rounded hover:bg-surface-hover transition-colors"
                aria-label={subOpen ? 'Collapse' : 'Expand'}
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-foreground-faint transition-transform',
                    subOpen && 'rotate-180',
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => openFolder(f.id)}
                className={cn(
                  'flex items-center gap-1.5 py-1 text-sm rounded-md transition-colors flex-1 truncate text-left',
                  active
                    ? 'bg-primary-subtle text-primary font-medium'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
                )}
              >
                {subOpen ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{f.name}</span>
              </button>
            </div>
            {subOpen && (
              <div className="ml-4 border-l border-border-subtle">
                <FolderTreeSub
                  parent={f}
                  openFolders={openFolders}
                  toggle={toggle}
                  currentFolderId={currentFolderId}
                  openFolder={openFolder}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FolderTree;
