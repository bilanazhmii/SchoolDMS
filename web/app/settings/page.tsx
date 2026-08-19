"use client";

import DashboardShell from '../../components/dashboard-shell';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="max-w-2xl space-y-4">
        <div><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-1 text-sm text-foreground-muted">Application preferences.</p></div>
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-foreground-muted">Your account and sync preferences are managed from the connected services. Google Drive connection can be managed on the <Link className="text-primary underline" href="/drive">Drive page</Link>.</div>
      </div>
    </DashboardShell>
  );
}
