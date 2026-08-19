"use client";

import { FC, useCallback, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Copy, Link2, X } from 'lucide-react';

import { createShareLink, sharePageUrl } from '../../services/sharing';
import type { SharePermission } from '../../services/sharing';
import { Button } from '../ui';

const ShareDialog: FC<{
  fileId: string;
  open: boolean;
  onClose: () => void;
}> = ({ fileId, open, onClose }) => {
  const qc = useQueryClient();
  const [perm, setPerm] = useState<SharePermission>('VIEW');
  const [url, setUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const link = await createShareLink(fileId, perm);
      setUrl(sharePageUrl(link.publicToken));
      qc.invalidateQueries({ queryKey: ['share-links'] });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fileId, perm, qc]);

  const copy = useCallback(async () => {
    if (!url) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${url}`,
      );
    } catch {
      // fallback
    }
    setCopying(false);
  }, [url]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-foreground">Bagikan tautan</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover transition-colors"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!url ? (
          <>
            <label className="block text-xs text-foreground-muted mb-1.5">
              Izin akses
            </label>
            <select
              value={perm}
              onChange={(e) => setPerm(e.target.value as SharePermission)}
              className="w-full mb-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="VIEW">Lihat (VIEW)</option>
              <option value="DOWNLOAD">Lihat & Unduh (DOWNLOAD)</option>
              <option value="EDIT">Edit (EDIT)</option>
              <option value="COMMENT">Komentar (COMMENT)</option>
            </select>

            <Button
              onClick={generate}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Membuat…' : 'Buat tautan'}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground mb-3">
              <Link2 className="h-4 w-4 shrink-0 text-foreground-muted" />
              <span className="truncate">{window.location.origin}{url}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copy}
                variant="secondary"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-1" />
                {copying ? 'Disalin!' : 'Salin'}
              </Button>
              <Button onClick={generate} variant="outline" className="flex-1">
                Baru
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareDialog;