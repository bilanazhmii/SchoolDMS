"use client";

import { FC } from 'react';

import {
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  MoreHorizontal,
  Star,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useExplorerContext } from '../../providers/explorer-provider';
import type { FileItem, FolderItem } from '../../types/explorer';
import { Button } from '../ui';

const ListView: FC<{
  files: FileItem[];
  folders: FolderItem[];
  onOpenFolder?: (folder: FolderItem) => void;
}> = ({ files, folders, onOpenFolder }) => {
  const { selection, setSelection, setPreviewFile } = useExplorerContext();

  function toggle(id: string) {
    setSelection(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
  }

  function openFile(f: FileItem) {
    setPreviewFile(f);
  }

  function formatSize(size: number | null): string {
    if (size == null) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(date: string): string {
    if (!date) return '';
    return date.slice(0, 10);
  }

  return (
    <div className="p-2">
      <table className="w-full table-auto">
        <thead className="text-left text-2xs text-foreground-faint uppercase tracking-wider">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Type</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Modified</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Size</th>
            <th className="px-3 py-2 font-medium hidden lg:table-cell">Status</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {folders.map((f) => {
            const selected = selection.includes(f.id);
            return (
              <tr
                key={f.id}
                onClick={() => {
                  toggle(f.id);
                  onOpenFolder?.(f);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenFolder?.(f);
                  }
                }}
                className={cn(
                  'group cursor-pointer border-b border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-md bg-surface-active flex items-center justify-center">
                      <Folder className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">{f.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">
                  Folder
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden md:table-cell">
                  {formatDate(f.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">—</td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Folder
                  </span>
                </td>
                <td className="px-3 py-2.5 w-8" />
              </tr>
            );
          })}

          {files.map((f) => {
            const selected = selection.includes(f.id);
            const Icon = getFileIcon(f.mimeType);
            return (
              <tr
                key={f.id}
                onClick={() => toggle(f.id)}
                onDoubleClick={() => openFile(f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    openFile(f);
                  }
                  if (e.key === ' ') {
                    e.preventDefault();
                    toggle(f.id);
                  }
                }}
                className={cn(
                  'group cursor-pointer border-b border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-md bg-surface-active flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-foreground-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">{f.name}</div>
                    </div>
                    {f.favorite && <Star className="h-3 w-3 text-warning shrink-0" />}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">
                  {getFileType(f.mimeType)}
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden md:table-cell">
                  {formatDate(f.modifiedAt)}
                </td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">
                  {formatSize(f.size)}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Synced
                  </span>
                </td>
                <td className="px-3 py-2.5 w-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFile(f);
                    }}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return FileSpreadsheet;
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('text')) return FileCode;
  return FileText;
}

function getFileType(mimeType: string | null): string {
  if (!mimeType) return 'File';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'Sheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document';
  if (mimeType.includes('json') || mimeType.includes('javascript')) return 'Code';
  return 'File';
}

export default ListView;
