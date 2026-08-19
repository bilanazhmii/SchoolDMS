"use client";

import { useQuery } from '@tanstack/react-query';
import DashboardShell from '../../components/dashboard-shell';

type Profile = { email: string; fullName?: string | null; phone?: string | null; status?: string };

export default function ProfilePage() {
  const { data, isLoading, error } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load profile');
      return response.json();
    },
  });

  return (
    <DashboardShell>
      <div className="max-w-2xl space-y-4">
        <div><h1 className="text-2xl font-semibold">Profile</h1><p className="mt-1 text-sm text-foreground-muted">Your account information.</p></div>
        <div className="rounded-lg border border-border bg-card p-6">
          {isLoading && <p className="text-sm text-foreground-muted">Loading profile…</p>}
          {error && <p className="text-sm text-red-500">Unable to load profile. Please sign in again.</p>}
          {data && <dl className="space-y-4 text-sm"><div><dt className="text-foreground-muted">Name</dt><dd>{data.fullName || '—'}</dd></div><div><dt className="text-foreground-muted">Email</dt><dd>{data.email}</dd></div><div><dt className="text-foreground-muted">Phone</dt><dd>{data.phone || '—'}</dd></div><div><dt className="text-foreground-muted">Status</dt><dd>{data.status || 'ACTIVE'}</dd></div></dl>}
        </div>
      </div>
    </DashboardShell>
  );
}
