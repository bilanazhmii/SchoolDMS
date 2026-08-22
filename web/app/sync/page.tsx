'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Computer, Download, Folder, FolderSync, HardDrive, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import DashboardShell from '../../components/dashboard-shell';
import { getSyncStatus, type SyncDevice } from '../../services/sync';

const WINDOWS_CLIENT_DOWNLOAD_URL = 'https://github.com/bilanazhmii/SchoolDMS/raw/client-download/SchoolDMS-Sync-win-x64.zip';

function formatDate(value: string | null) {
  if (!value) return 'Never connected';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function DeviceCard({ device }: { device: SyncDevice }) {
  const label = device.machineName || device.hostname || 'Windows computer';
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Computer className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-foreground">{label}</h2>
            <p className="mt-1 truncate text-xs text-foreground-muted" title={device.deviceIdentifier}>Device ID: {device.deviceIdentifier}</p>
          </div>
        </div>
        <div className={device.online ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success' : 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-active px-2.5 py-1 text-xs font-medium text-foreground-muted'}>
          {device.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {device.online ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="grid gap-3 border-b border-border-subtle bg-surface/40 px-5 py-4 text-xs sm:grid-cols-3">
        <div><div className="text-foreground-faint">Last seen</div><div className="mt-1 font-medium text-foreground-muted">{formatDate(device.lastSeen)}</div></div>
        <div><div className="text-foreground-faint">Active targets</div><div className="mt-1 font-medium text-foreground-muted">{device.activeTargetCount} of {device.targetCount}</div></div>
        <div><div className="text-foreground-faint">Client</div><div className="mt-1 font-medium text-foreground-muted">{device.clientVersion || 'Unknown'}</div></div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground"><HardDrive className="h-4 w-4 text-foreground-muted" />Sync targets</div>
          <span className="text-xs text-foreground-faint">Cloud copy remains available when offline</span>
        </div>
        {device.targets.length ? (
          <div className="space-y-2">
            {device.targets.map((target) => (
              <div key={target.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="h-4 w-4 shrink-0 text-foreground-muted" />
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-foreground">{target.relativeRoot}</div><div className="truncate text-xs text-foreground-muted" title={target.localPath}>{target.localPath}</div></div>
                </div>
                <span className={target.active ? 'shrink-0 text-xs font-medium text-success' : 'shrink-0 text-xs font-medium text-foreground-faint'}>{target.active ? 'Syncing' : 'Paused'}</span>
              </div>
            ))}
          </div>
        ) : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-foreground-muted">No target folders registered on this computer.</p>}
      </div>
    </article>
  );
}

export default function SyncPage() {
  const query = useQuery({ queryKey: ['sync-status'], queryFn: getSyncStatus, refetchInterval: 15000 });
  const data = query.data;

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary"><FolderSync className="h-4 w-4" />Computers</div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Your synced computers</h1><p className="mt-1 max-w-2xl text-sm text-foreground-muted">Each Windows computer has its own identity and target folders. A computer being offline never removes its cloud files.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={WINDOWS_CLIENT_DOWNLOAD_URL}
              download="SchoolDMS-Sync-win-x64.zip"
              aria-label="Download SchoolDMS Windows Sync Client"
              className="relative z-10 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Download className="h-4 w-4" />Download Windows Client
            </a>
            <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</button>
          </div>
        </div>

        {query.isLoading ? <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-foreground-muted">Loading computer status…</div> : query.isError ? <div className="rounded-xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">Unable to load computer status. Make sure the backend is deployed and your session is active.</div> : data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-foreground-muted">Computers online</div><div className="mt-1 text-2xl font-semibold text-foreground">{data.onlineCount}</div></div>
              <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-foreground-muted">Registered computers</div><div className="mt-1 text-2xl font-semibold text-foreground">{data.devices.length}</div></div>
              <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-foreground-muted">Last successful sync</div><div className="mt-1 truncate text-sm font-semibold text-foreground">{formatDate(data.lastSyncAt)}</div></div>
            </div>
            {data.devices.length ? <div className="grid gap-5 lg:grid-cols-2">{data.devices.map((device) => <DeviceCard key={device.id} device={device} />)}</div> : <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-foreground-faint" /><h2 className="mt-3 font-medium text-foreground">No computer has connected yet</h2><p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">Download the Windows Sync Client, sign in with this account, and choose one or more target folders.</p><Link href="/explorer" className="mt-4 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Open files</Link></div>}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
