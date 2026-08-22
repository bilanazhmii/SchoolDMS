"use client";

import { FC } from 'react';

import { FileCode, FileImage, FileSpreadsheet, FileText, Folder, Link2, Star } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useExplorerContext } from '../../providers/explorer-provider';
import type { FileItem, FolderItem } from '../../types/explorer';
import { Button } from '../ui';
import ContextMenu from './ContextMenu';

const ListView: FC<{
  files: FileItem[];
  folders: FolderItem[];
  onOpenFolder?: (folder: FolderItem) => void;
  onShare?: (item: FileItem | FolderItem) => void;
  onAction?: (action: 'rename' | 'copy' | 'move' | 'delete', item: FileItem | FolderItem) => void;
}> = ({ files, folders, onOpenFolder, onShare, onAction }) => {
  const { selection, setSelection, setPreviewFile } = useExplorerContext();

  function toggle(id: string) {
    setSelection(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
  }

  function openFile(file: FileItem) {
    setPreviewFile(file);
  }

  function formatSize(size: number | null): string {
    if (size == null) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatSyncStatus(status?: string | null): string {
    if (status === 'SYNCED') return 'Synced';
    if (status === 'FAILED') return 'Failed';
    if (status === 'CONFLICT') return 'Conflict';
    if (status === 'LOCAL_ONLY') return 'Local only';
    if (status === 'REMOTE_ONLY') return 'Remote only';
    return 'Pending';
  }

  function formatDate(date: string): string {
    if (!date) return '';
    return date.slice(0, 10);
  }

  return (
    <div className="p-3">
      <table className="w-full table-auto">
        <thead className="text-left text-2xs text-foreground-faint uppercase tracking-wider">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Type</th>
            <th className="px-3 py-2 font-medium hidden md:table-cell">Modified</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Size</th>
            <th className="px-3 py-2 font-medium hidden lg:table-cell">Status</th>
            <th className="px-3 py-2 w-20 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => {
            const selected = selection.includes(folder.id);
            return (
              <tr key={folder.id} onClick={() => toggle(folder.id)} onDoubleClick={() => onOpenFolder?.(folder)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpenFolder?.(folder); if (e.key === ' ') { e.preventDefault(); toggle(folder.id); } }} className={cn('group cursor-pointer border-b border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selected ? 'bg-primary-subtle' : 'hover:bg-surface-hover')}>
                <td className="px-3 py-2.5"><div className="flex items-center gap-3"><input type="checkbox" checked={selected} onChange={() => toggle(folder.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${folder.name}`} className="h-4 w-4 accent-primary" /><div className="h-7 w-7 shrink-0 rounded-md bg-surface-active flex items-center justify-center"><Folder className="h-3.5 w-3.5 text-primary" /></div><div className="min-w-0"><div className="truncate text-sm text-foreground">{folder.name}</div></div></div></td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">Folder</td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden md:table-cell">{formatDate(folder.createdAt)}</td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">—</td>
                <td className="px-3 py-2.5 hidden lg:table-cell"><span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Folder</span></td>
                <td className="px-3 py-2.5 w-20"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Share ${folder.name}`} onClick={(e) => { e.stopPropagation(); onShare?.(folder); }}><Link2 className="h-3.5 w-3.5" /></Button><ContextMenu label={folder.name} onRename={() => onAction?.('rename', folder)} onCopy={() => onAction?.('copy', folder)} onMove={() => onAction?.('move', folder)} onDelete={() => onAction?.('delete', folder)} /></div></td>
              </tr>
            );
          })}

          {files.map((file) => {
            const selected = selection.includes(file.id);
            const Icon = getFileIcon(file.name, file.mimeType);
            return (
              <tr key={file.id} onClick={() => toggle(file.id)} onDoubleClick={() => openFile(file)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openFile(file); if (e.key === ' ') { e.preventDefault(); toggle(file.id); } }} className={cn('group cursor-pointer border-b border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selected ? 'bg-primary-subtle' : 'hover:bg-surface-hover')}>
                <td className="px-3 py-2.5"><div className="flex items-center gap-3"><input type="checkbox" checked={selected} onChange={() => toggle(file.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${file.name}`} className="h-4 w-4 accent-primary" /><div className="h-7 w-7 shrink-0 rounded-md bg-surface-active flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-foreground-muted" /></div><div className="min-w-0"><div className="truncate text-sm text-foreground">{file.name}</div></div>{file.favorite && <Star className="h-3 w-3 text-warning shrink-0" />}</div></td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">{getFileType(file.name, file.mimeType)}</td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden md:table-cell">{formatDate(file.modifiedAt)}</td>
                <td className="px-3 py-2.5 text-xs text-foreground-muted hidden sm:table-cell">{formatSize(file.size)}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell"><span className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted"><span className={cn('h-1.5 w-1.5 rounded-full', file.syncStatus === 'SYNCED' ? 'bg-success' : file.syncStatus === 'FAILED' || file.syncStatus === 'CONFLICT' ? 'bg-danger' : 'bg-warning')} />{formatSyncStatus(file.syncStatus)}</span></td>
                <td className="px-3 py-2.5 w-20"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Share ${file.name}`} onClick={(e) => { e.stopPropagation(); onShare?.(file); }}><Link2 className="h-3.5 w-3.5" /></Button><ContextMenu label={file.name} onRename={() => onAction?.('rename', file)} onCopy={() => onAction?.('copy', file)} onMove={() => onAction?.('move', file)} onDelete={() => onAction?.('delete', file)} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function effectiveMimeType(name: string, mimeType: string | null) {
  const declared = mimeType?.trim();
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return declared;
  const extension = name.toLowerCase().split('.').pop() ?? '';
  const byExtension: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', pdf: 'application/pdf', json: 'application/json', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip' };
  return byExtension[extension] ?? declared ?? 'application/octet-stream';
}

function getFileIcon(name: string, mimeType: string | null) {
  const effective = effectiveMimeType(name, mimeType);
  if (effective.startsWith('image/')) return FileImage;
  if (effective.includes('spreadsheet') || effective.includes('sheet')) return FileSpreadsheet;
  if (effective.includes('json') || effective.includes('javascript') || effective.includes('text')) return FileCode;
  return FileText;
}

function getFileType(name: string, mimeType: string | null): string {
  const effective = effectiveMimeType(name, mimeType);
  if (effective.startsWith('image/')) return 'Image';
  if (effective.includes('video')) return 'Video';
  if (effective.includes('audio')) return 'Audio';
  if (effective.includes('pdf')) return 'PDF';
  if (effective.includes('spreadsheet') || effective.includes('sheet')) return 'Sheet';
  if (effective.includes('document') || effective.includes('word')) return 'Document';
  if (effective.includes('presentation') || effective.includes('powerpoint')) return 'Presentation';
  if (effective.includes('archive') || effective.includes('zip') || effective.includes('rar')) return 'Archive';
  if (effective.includes('json') || effective.includes('javascript') || effective.includes('text')) return 'Text / Code';
  return 'File';
}

export default ListView;
