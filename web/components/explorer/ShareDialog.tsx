"use client";

import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Copy, Link2, X } from 'lucide-react';

import { createFolderShareLink, createShareLink, sharePageUrl } from '../../services/sharing';
import type { SharePermission } from '../../services/sharing';
import { Button } from '../ui';

const ShareDialog: FC<{
  fileId?: string;
  folderId?: string;
  targetName?: string;
  open: boolean;
  onClose: () => void;
}> = ({ fileId, folderId, targetName, open, onClose }) => {
  const qc = useQueryClient();
  const [perm, setPerm] = useState<SharePermission>('VIEW');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrSrc = useMemo(() => url ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}` : null, [url]);

  useEffect(() => {
    setPerm('VIEW');
    setDescription('');
    setUrl(null);
    setError(null);
  }, [fileId, folderId, open]);

  const generate = useCallback(async () => {
    if (!fileId && !folderId) return;
    setLoading(true);
    setError(null);
    try {
      const link = fileId
        ? await createShareLink(fileId, perm, description)
        : await createFolderShareLink(folderId as string, perm, description);
      if (!link.publicToken) throw new Error('Token link tidak diterima dari server.');
      setUrl(`${window.location.origin}${sharePageUrl(link.publicToken)}`);
      qc.invalidateQueries({ queryKey: ['share-links'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link gagal dibuat.');
    } finally {
      setLoading(false);
    }
  }, [fileId, folderId, perm, description, qc]);

  const copy = useCallback(async () => {
    if (!url) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(url);
    } finally {
      setCopying(false);
    }
  }, [url]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">Bagikan {folderId ? 'folder' : 'file'}</div>
            {targetName && <div className="max-w-[260px] truncate text-xs text-foreground-muted">{targetName}</div>}
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-hover" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>

        {!url ? (
          <>
            <label className="mb-1.5 block text-xs text-foreground-muted">Izin akses guest</label>
            <select value={perm} onChange={(e) => setPerm(e.target.value as SharePermission)} className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <option value="VIEW">View — lihat saja</option>
              <option value="COMMENT">Comment — lihat dan komentar</option>
              <option value="DOWNLOAD">Download — lihat dan unduh</option>
              <option value="EDIT">Edit — ubah konten</option>
            </select>
            <label className="mb-1.5 block text-xs text-foreground-muted">Deskripsi link (opsional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Contoh: Foto kegiatan sekolah 8 Agustus 2026" className="mb-3 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground" />
            <p className="mb-3 text-xs text-foreground-muted">Link dibuat baru untuk target ini dan tokennya tidak dibagikan ke target lain.</p>
            {error && <div className="mb-3 rounded border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{error}</div>}
            <Button onClick={generate} disabled={loading} className="w-full">{loading ? 'Membuat…' : 'Buat share link'}</Button>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"><Link2 className="h-4 w-4 shrink-0 text-foreground-muted" /><span className="break-all">{url}</span></div>
            <div className="mb-2 rounded bg-surface-active p-2 text-xs text-foreground-muted">Permission: <strong className="text-foreground">{perm}</strong></div>
            {description && <div className="mb-3 rounded bg-surface-active p-2 text-xs text-foreground-muted">Deskripsi: {description}</div>}
            {qrSrc && <div className="mb-3 flex flex-col items-center gap-2 rounded border border-border bg-white p-3"><img src={qrSrc} alt="QR code for custom share link" className="h-48 w-48" /><span className="text-[10px] text-black">Scan untuk membuka sebagai guest</span></div>}
            <div className="flex gap-2"><Button onClick={copy} variant="secondary" className="flex-1"><Copy className="mr-1 h-4 w-4" />{copying ? 'Disalin!' : 'Salin link'}</Button><Button onClick={() => setUrl(null)} variant="outline" className="flex-1">Buat baru</Button></div>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareDialog;
