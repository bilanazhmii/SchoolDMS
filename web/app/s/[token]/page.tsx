"use client";

import { useEffect, useState } from 'react';

import { useParams } from 'next/navigation';

import { Download, FileText, Folder, Link2, ShieldAlert } from 'lucide-react';

import DashboardShell from '../../../components/dashboard-shell';
import { fetchShare, shareDownloadUrl } from '../../../services/sharing';
import type { PublicShareFile, PublicShareFolder } from '../../../services/sharing';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [data, setData] = useState<PublicShareFile | PublicShareFolder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setError('Tautan tidak valid.');
      setLoading(false);
      return;
    }
    fetchShare(token)
      .then((d) => {
        if (mounted) setData(d);
      })
      .catch((e) => {
        if (mounted) setError(e?.message ?? 'Tautan tidak ditemukan atau kedaluwarsa.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-xl">
        <div className="rounded-lg border border-border bg-card p-6">
          {loading ? (
            <div className="py-10 text-center text-sm text-foreground-muted">Memuat…</div>
          ) : error ? (
            <div className="py-10 text-center">
              <ShieldAlert className="mx-auto h-10 w-10 text-warning mb-3" />
              <p className="text-sm text-foreground-muted">{error}</p>
            </div>
          ) : data?.type === 'file' ? (
            <FileView data={data} token={token} />
          ) : data ? (
            <FolderView data={data} />
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function FileView({ data, token }: { data: PublicShareFile; token: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-lg bg-surface-active flex items-center justify-center">
          <FileText className="h-5 w-5 text-foreground-muted" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">{data.file.name}</div>
          <div className="text-xs text-foreground-muted">
            {data.file.mimeType ?? 'File'} · {formatBytes(data.file.size)}
          </div>
        </div>
      </div>

      <div className="rounded-md bg-surface-active p-3 text-xs text-foreground-muted space-y-1 mb-4">
        <div className="flex justify-between">
          <span>Izin</span>
          <span className="font-medium text-foreground">{data.permission}</span>
        </div>
        <div className="flex justify-between">
          <span>Kedaluwarsa</span>
          <span className="font-medium text-foreground">
            {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : 'Tidak ada'}
          </span>
        </div>
        {data.downloadLimit > 0 && (
          <div className="flex justify-between">
            <span>Unduhan</span>
            <span className="font-medium text-foreground">
              {data.downloadCount} / {data.downloadLimit}
            </span>
          </div>
        )}
      </div>

      <a
        href={shareDownloadUrl(token)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
      >
        <Download className="h-4 w-4" />
        Unduh
      </a>
    </div>
  );
}

function FolderView({ data }: { data: PublicShareFolder }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-lg bg-surface-active flex items-center justify-center">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">{data.folder.name}</div>
          <div className="text-xs text-foreground-muted">{data.folder.files} berkas</div>
        </div>
      </div>
      <div className="rounded-md bg-surface-active p-3 text-xs text-foreground-muted flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5" />
        Folder publik dengan izin {data.permission}
      </div>
    </div>
  );
}
