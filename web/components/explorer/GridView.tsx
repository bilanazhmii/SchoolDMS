"use client";

import { FC } from 'react';

import { motion } from 'framer-motion';

import {
  FileText,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileCode,
  Folder,
  MoreHorizontal,
  Star,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useExplorerContext } from '../../providers/explorer-provider';
import type { FileItem, FolderItem } from '../../types/explorer';
import { Button } from '../ui';

const GridView: FC<{
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
    if (size == null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
      {folders.map((f) => {
        const selected = selection.includes(f.id);
        return (
          <motion.div
            key={f.id}
            layout
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
              'group relative rounded-lg border p-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              selected
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-card hover:bg-surface-hover',
            )}
          >
            {/* Folder icon */}
            <div className="mb-3 flex h-14 items-center justify-center rounded-md bg-surface-active">
              <Folder className="h-7 w-7 text-primary" />
            </div>

            {/* Metadata */}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{f.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-foreground-faint">
                <span>Folder</span>
                <span>·</span>
                <span>{formatDate(f.createdAt)}</span>
              </div>
            </div>
          </motion.div>
        );
      })}

      {files.map((f) => {
        const selected = selection.includes(f.id);
        const Icon = getFileIcon(f.mimeType);
        return (
          <motion.div
            key={f.id}
            layout
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
              'group relative rounded-lg border p-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              selected
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-card hover:bg-surface-hover',
            )}
          >
            {/* Hover/selected actions */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                aria-label="More actions"
                onClick={(e) => {
                  e.stopPropagation();
                  openFile(f);
                }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
            {f.favorite && (
              <div className="absolute bottom-2 right-2">
                <Star className="h-3.5 w-3.5 text-warning" />
              </div>
            )}

            {/* File icon */}
            <div className="mb-3 flex h-14 items-center justify-center rounded-md bg-surface-active">
              <Icon className="h-7 w-7 text-foreground-muted" />
            </div>

            {/* Metadata */}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{f.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-foreground-faint">
                <span>{f.size != null ? formatSize(f.size) : '—'}</span>
                <span>·</span>
                <span>{formatDate(f.modifiedAt)}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
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

function formatDate(date: string): string {
  if (!date) return '';
  return date.slice(0, 10);
}

export default GridView;
