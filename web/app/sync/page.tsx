import Link from 'next/link';
import { Download, FolderSync } from 'lucide-react';
import DashboardShell from '../../components/dashboard-shell';

export default function SyncPage() {
  return (
    <DashboardShell>
      <div className="max-w-2xl space-y-6">
        <div><h1 className="text-2xl font-semibold">Desktop sync</h1><p className="mt-1 text-sm text-foreground-muted">Sync a local Windows folder with your SchoolDMS account.</p></div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3"><FolderSync className="h-6 w-6 text-primary" /><h2 className="font-medium">DocumentSyncClient</h2></div>
          <p className="text-sm text-foreground-muted">Install the Windows app, sign in with the same account, and choose a local folder. Changes are queued and synchronized automatically.</p>
          <div className="rounded-md bg-surface-active p-3 text-sm"><strong>Server URL:</strong><br />https://schooldms-production.up.railway.app</div>
          <p className="text-xs text-foreground-muted">The desktop client is distributed from the repository release/publish folder. It is separate from Google Drive OAuth.</p>
          <Link href="/explorer" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Download className="h-4 w-4" />Open files</Link>
        </div>
      </div>
    </DashboardShell>
  );
}
