"use client";

import { FC, useEffect, useState } from 'react';

import { fetchPreviewUrl } from '../../services/explorer';
import type { FileItem } from '../../types/explorer';

const FilePreviewPanel: FC<{ file?: FileItem | null }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<'image' | 'iframe' | 'none'>('none');

  useEffect(() => {
    let mounted = true;
    if (!file) {
      setUrl(null);
      setKind('none');
      return;
    }
    fetchPreviewUrl(file.id)
      .then((d) => {
        if (!mounted) return;
        const raw = d.url || '';
        const api = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
        const resolved = raw.startsWith('http') ? raw : `${api}${raw.startsWith('/') ? raw : `/${raw}`}`;
        setUrl(resolved || null);
        const mime = file.mimeType ?? '';
        setKind(mime.startsWith('image/') ? 'image' : resolved ? 'iframe' : 'none');
      })
      .catch(() => {
        if (mounted) {
          setUrl(null);
          setKind('none');
        }
      });
    return () => {
      mounted = false;
    };
  }, [file]);

  if (!file) return <div className="p-4 text-sm text-foreground-muted">No file selected</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">Preview</div>
      {kind === 'image' && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="w-full max-h-72 object-contain rounded border border-border bg-white" />
      ) : kind === 'iframe' && url ? (
        <iframe src={url} className="w-full h-72 border rounded" title="preview" />
      ) : (
        <div className="h-24 bg-surface-active flex items-center justify-center text-xs text-foreground-muted rounded">
          Preview not available
        </div>
      )}
    </div>
  );
};

export default FilePreviewPanel;
