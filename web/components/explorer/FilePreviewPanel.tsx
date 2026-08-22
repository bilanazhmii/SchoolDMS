"use client";

import { FC, useEffect, useState } from 'react';

import api from '../../lib/axios';
import type { FileItem } from '../../types/explorer';

const FilePreviewPanel: FC<{ file?: FileItem | null }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(false);
    setFullScreen(false);

    if (!file) return;

    api.get(`/files/${file.id}/stream`, { responseType: 'blob' })
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

  if (!file) return <div className="p-4 text-sm text-foreground-muted">No file selected</div>;

  const fileName = file.name;
  const mime = effectiveMimeType(fileName, file.mimeType);
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

  function renderContent(large = false) {
    if (!url) return null;
    if (isImage) {
      return (
        <button type="button" onClick={() => setFullScreen(true)} className="block w-full cursor-zoom-in" aria-label={`Buka ${fileName} ukuran penuh`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={fileName} className={large ? 'max-h-[85vh] max-w-[95vw] object-contain' : 'max-h-80 w-full rounded border border-border bg-black/5 object-contain'} />
        </button>
      );
    }
    if (isVideo) return <video src={url} controls autoPlay={large} playsInline className={large ? 'max-h-[85vh] max-w-[95vw] rounded bg-black' : 'max-h-80 w-full rounded border border-border bg-black'} />;
    if (isAudio) return <audio src={url} controls autoPlay={large} className="w-full" />;
    if (isPdf || isText) return <iframe src={url} title={`Preview ${fileName}`} className={large ? 'h-[85vh] w-[95vw] rounded border bg-white' : 'h-80 w-full rounded border bg-white'} />;
    return null;
  }

  const canRender = isImage || isVideo || isAudio || isPdf || isText;

  return (
    <div className="space-y-3 p-4">
      <div>
        <div className="text-sm font-semibold">Preview</div>
        <div className="truncate text-xs text-foreground-muted" title={file.relativePath ?? fileName}>{file.relativePath ?? fileName}</div>
      </div>

      {url && canRender ? renderContent() : url ? (
        <div className="flex h-28 flex-col items-center justify-center gap-2 rounded border border-border bg-surface-active text-xs text-foreground-muted">
          <span>Format ini tidak dapat dirender langsung di browser.</span>
          <button type="button" onClick={download} className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">Buka / Download File</button>
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded border border-border bg-surface-active text-xs text-foreground-muted">
          {error ? 'Preview gagal dimuat. Periksa koneksi atau izin file.' : 'Memuat preview…'}
        </div>
      )}

      {url && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => canRender ? setFullScreen(true) : download()} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary-hover">Lihat</button>
          <button type="button" onClick={download} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-surface-hover">Download</button>
        </div>
      )}

      {fullScreen && url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`Full view ${fileName}`} onClick={() => setFullScreen(false)}>
          <button type="button" onClick={() => setFullScreen(false)} className="absolute right-4 top-4 rounded bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">Tutup</button>
          <div onClick={(event) => event.stopPropagation()}>{renderContent(true)}</div>
        </div>
      )}
    </div>
  );
};

function effectiveMimeType(name: string, mimeType: string | null) {
  const declared = mimeType?.trim();
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return declared;
  const extension = name.toLowerCase().split('.').pop() ?? '';
  const byExtension: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml', md: 'text/markdown' };
  return byExtension[extension] ?? declared ?? 'application/octet-stream';
}

export default FilePreviewPanel;
