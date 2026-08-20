"use client";

import { FC, useEffect, useState } from 'react';

import { motion } from 'framer-motion';

import {
  FileText,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileCode,
  Folder,
  Link2,
  Star,
} from 'lucide-react';

import api from '../../lib/axios';
import { cn } from '../../lib/utils';
import { useExplorerContext } from '../../providers/explorer-provider';
import type { FileItem, FolderItem } from '../../types/explorer';
import { Button } from '../ui';
import ContextMenu from './ContextMenu';

const GridView: FC<{
  files: FileItem[];
  folders: FolderItem[];
  onOpenFolder?: (folder: FolderItem) => void;
  onShare?: (item: FileItem | FolderItem) => void;
  onAction?: (action: 'rename' | 'copy' | 'delete', item: FileItem | FolderItem) => void;
}> = ({ files, folders, onOpenFolder, onShare, onAction }) => {
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
      {folders.map((f) => {
        const selected = selection.includes(f.id);
        return (
          <motion.div
            key={f.id}
            layout
            onClick={() => toggle(f.id)}
            onDoubleClick={() => onOpenFolder?.(f)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onOpenFolder?.(f);
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
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Share ${f.name}`} onClick={(e) => { e.stopPropagation(); onShare?.(f); }}><Link2 className="h-3.5 w-3.5" /></Button>
              <ContextMenu label={f.name} onRename={() => onAction?.('rename', f)} onCopy={() => onAction?.('copy', f)} onDelete={() => onAction?.('delete', f)} />
            </div>

            <input type="checkbox" checked={selected} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${f.name}`} className="absolute left-2 top-2 h-4 w-4 accent-primary" />
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
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label={`Share ${f.name}`} onClick={(e) => { e.stopPropagation(); onShare?.(f); }}>
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              <ContextMenu label={f.name} onRename={() => onAction?.('rename', f)} onCopy={() => onAction?.('copy', f)} onDelete={() => onAction?.('delete', f)} />
            </div>
            {f.favorite && (
              <div className="absolute bottom-2 right-2">
                <Star className="h-3.5 w-3.5 text-warning" />
              </div>
            )}

            <input type="checkbox" checked={selected} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${f.name}`} className="absolute left-2 top-2 h-4 w-4 accent-primary" />
            <FileThumbnail file={f} fallback={<Icon className="h-7 w-7 text-foreground-muted" />} />

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

const FileThumbnail: FC<{ file: FileItem; fallback: React.ReactNode }> = ({ file, fallback }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file.mimeType?.startsWith('image/')) return;
    let mounted = true;
    let objectUrl: string | null = null;
    api.get(`/files/${file.id}/stream`, { responseType: 'blob' })
      .then((response) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.mimeType]);

  return (
    <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-md bg-surface-active">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={file.name} className="h-full w-full object-cover" />
      ) : fallback}
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
