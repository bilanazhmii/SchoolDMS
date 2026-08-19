"use client";

import { useQuery } from '@tanstack/react-query';

import { Cloud, RefreshCw, Unplug } from 'lucide-react';

import DashboardShell from '../../components/dashboard-shell';
import api from '../../lib/axios';

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

export default function DrivePage() {
  const { data, isLoading, refetch } = useQuery<{
    connected: boolean;
    about?: { user?: { emailAddress?: string; displayName?: string }; storageQuota?: { usage?: string; limit?: string } };
  }>({
    queryKey: ['drive', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/drive/status');
      return unwrap(data);
    },
    staleTime: 30_000,
  });

  const connected = data?.connected ?? false;

  return (
    <DashboardShell>
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Google Drive</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Connect your Google Drive account to sync documents to the cloud.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-success-subtle flex items-center justify-center">
              <Cloud className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">
                {isLoading ? 'Checking connection…' : connected ? 'Connected' : 'Not connected'}
              </div>
              <div className="text-xs text-foreground-muted mt-0.5">
                {connected
                  ? data?.about?.user?.emailAddress ?? 'Google Drive account connected'
                  : 'No Google account linked yet.'}
              </div>
            </div>
            {connected ? (
              <button
                onClick={() => {
                  api
                    .delete('/drive/disconnect')
                    .then(() => refetch())
                    .catch(() => {});
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
              >
                <Unplug className="h-4 w-4" />
                Disconnect
              </button>
            ) : (
              <a
                href="/api/drive/connect"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
              >
                <Cloud className="h-4 w-4" />
                Connect
              </a>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-foreground-muted">
            <RefreshCw className="h-3.5 w-3.5" />
            <button onClick={() => refetch()} className="hover:text-foreground transition-colors">
              Check status again
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-xs text-foreground-muted">
          <strong className="text-foreground">Note:</strong> Connecting requires a valid Google OAuth client
          (GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI) configured on the
          backend. Without those credentials the OAuth flow cannot complete.
        </div>
      </div>
    </DashboardShell>
  );
}
