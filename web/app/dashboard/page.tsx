"use client";

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { useQuery } from '@tanstack/react-query';

import {
  Cloud,
  Download,
  FileText,
  Folder,
  HardDrive,
  RefreshCw,
  Search,
  Share2,
  Star,
  Upload,
} from 'lucide-react';

import DashboardShell from '../../components/dashboard-shell';
import api from '../../lib/axios';
import { fetchFolderContents } from '../../services/explorer';
import type { FileItem } from '../../types/explorer';

const WINDOWS_CLIENT_DOWNLOAD_URL = 'https://github.com/bilanazhmii/SchoolDMS/raw/client-download/SchoolDMS-Sync-win-x64.zip';

function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    'data' in body &&
    (body as { success: boolean }).success
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Renders a relative timestamp only after mount to avoid SSR hydration mismatch. */
function TimeAgo({ iso }: { iso: string | null }) {
  const [text, setText] = useState('—');
  useEffect(() => {
    if (!iso) {
      setText('—');
      return;
    }
    setText(timeAgo(iso));
  }, [iso]);
  if (!iso) return null;
  return <span>{text}</span>;
}

export default function Page() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-sm text-foreground-muted mt-1">Here&apos;s what&apos;s happening with your documents.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={WINDOWS_CLIENT_DOWNLOAD_URL}
              download="SchoolDMS-Sync-win-x64.zip"
              aria-label="Download SchoolDMS Windows Sync Client"
              className="relative z-10 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Download Windows Client
            </a>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Link>
          </div>
        </div>

        {/* Storage overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StorageCard />
          <DriveCard />
          <SyncCard />
        </div>

        {/* Main content: recent files + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <RecentFiles />
            <QuickActions />
          </div>
          <div className="space-y-6">
            <RecentActivity />
            <Favorites />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ---------- Storage Card ---------- */
function StorageCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'storage'],
    queryFn: () => fetchFolderContents(undefined),
    staleTime: 30_000,
  });

  const files = data?.files ?? [];
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary-subtle flex items-center justify-center">
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">Storage</div>
            <div className="text-2xs text-foreground-faint">
              {isLoading ? 'Loading…' : `${files.length} files in root`}
            </div>
          </div>
        </div>
        <Link href="/explorer" className="text-2xs text-foreground-faint hover:text-foreground transition-colors">
          Manage
        </Link>
      </div>
      <div className="text-2xl font-semibold text-foreground">{formatBytes(totalBytes)}</div>
      <div className="mt-1 text-2xs text-foreground-faint">total document size</div>
    </div>
  );
}

/* ---------- Drive Card ---------- */
function DriveCard() {
  const { data, isLoading } = useQuery<{ connected: boolean; about?: { user?: { emailAddress?: string } } }>({
    queryKey: ['dashboard', 'drive'],
    queryFn: async () => {
      const { data } = await api.get('/drive/status');
      return unwrap(data);
    },
    staleTime: 60_000,
  });

  const connected = data?.connected ?? false;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-success-subtle flex items-center justify-center">
            <Cloud className="h-4 w-4 text-success" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">Google Drive</div>
            <div className="text-2xs text-foreground-faint">
              {isLoading ? 'Checking…' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>
        <Link href="/drive" className="text-2xs text-foreground-faint hover:text-foreground transition-colors">
          Details
        </Link>
      </div>
      {connected ? (
        <div className="flex items-center gap-1.5 text-2xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>Connected to {data?.about?.user?.emailAddress ?? 'Google Drive'}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-2xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span>Connect a Google account to enable Drive sync</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Sync Card ---------- */
function SyncCard() {
  const { data, isLoading } = useQuery<{
    onlineCount: number;
    devices: { hostname: string | null; machineName: string | null; online: boolean; lastSeen: string | null }[];
    totals: { all: number; synced: number; failed: number };
    lastSyncAt: string | null;
  }>({
    queryKey: ['dashboard', 'sync-status'],
    queryFn: async () => {
      const { data } = await api.get('/sync/status');
      return unwrap(data);
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const online = data?.onlineCount ?? 0;
  const lastSyncAt = data?.lastSyncAt ?? null;
  const failed = data?.totals?.failed ?? 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-surface-active flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-foreground-muted" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">Sync</div>
            <div className="text-2xs text-foreground-faint">Desktop sync client</div>
          </div>
        </div>
        <Link href="/drive" className="text-2xs text-foreground-faint hover:text-foreground transition-colors">
          View
        </Link>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-1.5 text-2xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          <span>Checking…</span>
        </div>
      ) : online > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>
              {online} device{online > 1 ? 's' : ''} online
              {lastSyncAt ? ' · last sync ' : ''}
              {lastSyncAt ? <TimeAgo iso={lastSyncAt} /> : null}
            </span>
          </div>
          {failed > 0 && (
            <div className="flex items-center gap-1.5 text-2xs text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              <span>{failed} failed job{failed > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-2xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span>Desktop client not connected — sign in on Windows to sync</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Recent Files ---------- */
function RecentFiles() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: () => fetchFolderContents(undefined),
    staleTime: 30_000,
  });

  const recent: FileItem[] = (data?.files ?? [])
    .slice()
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, 5);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Recent files</h2>
        <Link href="/explorer" className="text-2xs text-foreground-faint hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">No files yet. Upload your first document.</div>
        ) : (
          recent.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
              <div className="h-8 w-8 rounded-md bg-surface-active flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-foreground-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground truncate">{file.name}</div>
                <div className="text-2xs text-foreground-faint">
                  {file.mimeType ?? 'File'} · {formatBytes(file.size ?? 0)}
                </div>
              </div>
              <span className="text-2xs text-foreground-faint shrink-0">
                <TimeAgo iso={file.modifiedAt} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------- Quick Actions ---------- */
function QuickActions() {
  const actions = [
    { label: 'New folder', href: '/explorer', icon: Folder },
    { label: 'Upload files', href: '/explorer', icon: Upload },
    { label: 'Search', href: '/explorer/search', icon: Search },
    { label: 'Google Drive', href: '/drive', icon: Cloud },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground mb-3">Quick actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-md border border-border p-3 hover:bg-surface-hover hover:border-border-subtle transition-colors"
            >
              <Icon className="h-4 w-4 text-foreground-muted" />
              <span className="text-2xs text-foreground-muted text-center">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Recent Activity ---------- */
function RecentActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'recent-files-activity'],
    queryFn: () => fetchFolderContents(undefined),
    staleTime: 30_000,
  });

  const files = data?.files ?? [];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">Loading…</div>
        ) : files.length === 0 ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">No activity yet.</div>
        ) : (
          files
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((file) => (
              <div key={file.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="h-6 w-6 rounded-md bg-surface-active flex items-center justify-center shrink-0 mt-0.5">
                  <Upload className="h-3 w-3 text-foreground-faint" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-foreground">Uploaded {file.name}</div>
                  <div className="text-2xs text-foreground-faint">
                    <TimeAgo iso={file.createdAt} />
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

/* ---------- Favorites ---------- */
function Favorites() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'favorites'],
    queryFn: () => fetchFolderContents(undefined),
    staleTime: 30_000,
  });

  const favorites = (data?.files ?? []).filter((f) => f.favorite);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Favorites</h2>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">Loading…</div>
        ) : favorites.length === 0 ? (
          <div className="px-4 py-6 text-sm text-foreground-muted">No favorites yet.</div>
        ) : (
          favorites.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
              <div className="h-7 w-7 rounded-md bg-surface-active flex items-center justify-center shrink-0">
                <FileText className="h-3.5 w-3.5 text-foreground-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-foreground truncate">{file.name}</div>
              </div>
              <Star className="h-3.5 w-3.5 text-warning shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
