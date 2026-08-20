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

    setUrl(null);
    setError(false);
    api
      .get(`/files/${file.id}/stream`, { responseType: 'blob' })
      .then((response) => {
        if (!mounted) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (mounted) setError(true);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) {
    return <div className="p-4 text-sm text-foreground-muted">No file selected</div>;
  }

  const fileName = file.name;
  const mime = file.mimeType ?? 'application/octet-stream';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = mime === 'application/pdf';
  const isText = mime.startsWith('text/') || mime === 'application/json';

  function download() {
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">Preview</div>
        <div className="text-xs text-foreground-muted truncate" title={file.relativePath ?? file.name}>
          {file.relativePath ?? file.name}
        </div>
      </div>

      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="w-full max-h-80 object-contain rounded border border-border bg-black/5" />
      ) : url && isVideo ? (
        <video src={url} controls playsInline className="w-full max-h-80 rounded border border-border bg-black" />
      ) : url && isAudio ? (
        <audio src={url} controls className="w-full" />
      ) : url && (isPdf || isText) ? (
        <iframe src={url} className="w-full h-80 border rounded bg-white" title={`Preview ${file.name}`} />
      ) : url ? (
        <div className="h-28 rounded border border-border bg-surface-active flex flex-col items-center justify-center gap-2 text-xs text-foreground-muted">
          <span>Format ini tidak dapat dirender langsung di browser.</span>
          <button type="button" onClick={download} className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">
            Buka / Download File
          </button>
        </div>
      ) : (
        <div className="h-28 rounded border border-border bg-surface-active flex items-center justify-center text-xs text-foreground-muted">
          {error ? 'Preview gagal dimuat. Periksa koneksi atau izin file.' : 'Memuat preview…'}
        </div>
      )}

      {url && (isImage || isVideo || isAudio || isPdf || isText) && (
        <button type="button" onClick={download} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-surface-hover">
          Download {file.name}
        </button>
      )}
    </div>
  );
};

export default FilePreviewPanel;
