"use client";

import React, { Suspense, useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

import { FileText, Folder, Search } from 'lucide-react';

import ExplorerShell from '../../../components/explorer-shell';
import { searchExplorer } from '../../../services/explorer';
import { Skeleton } from '../../../components/ui';
import type { FileItem, FolderItem } from '../../../types/explorer';
import Link from 'next/link';

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['explorer', 'search', q],
    queryFn: () => searchExplorer(q),
    enabled: q.trim().length > 0,
  });

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  if (!hasMounted) return null;
  if (!q.trim()) {
    return (
      <div className="p-12 text-center text-sm text-foreground-muted">
        Type a query above to search your files and folders.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-12 text-center text-sm text-foreground-muted">
        Search failed. Please try again.
      </div>
    );
  }

  const items: (FileItem | FolderItem)[] = data ?? [];

  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-foreground-muted">
        No results for “{q}”.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div
          key={`${'mimeType' in item ? 'file' : 'folder'}-${item.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
        >
          <div className="h-8 w-8 shrink-0 rounded-md bg-surface-active flex items-center justify-center">
            {'mimeType' in item ? (
              <FileText className="h-4 w-4 text-foreground-muted" />
            ) : (
              <Folder className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">{item.name}</div>
            <div className="text-2xs text-foreground-faint">
              {'mimeType' in item ? 'File' : 'Folder'}
            </div>
          </div>
          {'mimeType' in item ? (
            <span className="text-2xs text-foreground-faint shrink-0">
              {(item as FileItem).size != null
                ? `${formatSize((item as FileItem).size as number)}`
                : ''}
            </span>
          ) : (
            <Link
              href={`/explorer/${item.id}`}
              className="text-2xs text-primary hover:underline shrink-0"
            >
              Open
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SearchPage() {
  return (
    <ExplorerShell>
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-foreground-faint" />
        <span className="text-sm text-foreground">Search results</span>
      </div>
      <Suspense fallback={<div className="p-4"><Skeleton className="h-10 w-full rounded" /></div>}>
        <SearchResults />
      </Suspense>
    </ExplorerShell>
  );
}
