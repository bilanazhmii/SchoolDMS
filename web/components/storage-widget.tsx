"use client";

import { FC } from 'react';

import { useQuery } from '@tanstack/react-query';

import { fetchFolderContents } from '../services/explorer';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const StorageWidget: FC = () => {
  const { data } = useQuery({
    queryKey: ['widget', 'storage'],
    queryFn: () => fetchFolderContents(undefined),
    staleTime: 30_000,
  });

  const files = data?.files ?? [];
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return (
    <div className="w-48 p-2 rounded-md bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-100">
      <div className="flex items-center justify-between text-xs">
        <div className="font-medium">Storage</div>
        <div className="text-muted-foreground">{files.length} files</div>
      </div>
      <div className="mt-2 text-2xs text-muted-foreground">{formatBytes(totalBytes)} total</div>
    </div>
  );
};

export default StorageWidget;
