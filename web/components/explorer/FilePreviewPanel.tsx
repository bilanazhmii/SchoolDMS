"use client";

import { FC, useEffect, useState } from 'react';

import api from '../../lib/axios';
import type { FileItem } from '../../types/explorer';

const FilePreviewPanel: FC<{ file?: FileItem | null }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;
    if (!file) {
      setUrl(null);
      setError(false);
      return;
    }

    // <img>/<iframe> cannot attach the Railway Bearer header. Fetch through
    // axios instead, which adds the token, then preview the authenticated blob.
    api.get(`/files/${file.id}/stream`, { responseType: 'blob' })
      .then((response) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
        setError(false);
      })
      .catch(() => {
        if (mounted) {
          setUrl(null);
          setError(true);
        }
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return <div className="p-4 text-sm text-foreground-muted">No file selected</div>;

  const isImage = file.mimeType?.startsWith('image/') ?? false;
  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">Preview</div>
      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="w-full max-h-72 object-contain rounded border border-border bg-white" />
      ) : url ? (
        <iframe src={url} className="w-full h-72 border rounded" title="preview" />
      ) : (
        <div className="h-24 bg-surface-active flex items-center justify-center text-xs text-foreground-muted rounded">
          {error ? 'Preview gagal dimuat' : 'Memuat preview…'}
        </div>
      )}
    </div>
  );
};

export default FilePreviewPanel;
