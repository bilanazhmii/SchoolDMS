"use client";

import { FC } from 'react';

import { useQuery } from '@tanstack/react-query';

import api from '../lib/axios';

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

const DriveStatus: FC = () => {
  const { data, isLoading } = useQuery<{ connected: boolean }>({
    queryKey: ['drive', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/drive/status');
      return unwrap(data);
    },
    staleTime: 60_000,
  });

  const connected = data?.connected ?? false;

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-transparent">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      <div className="text-sm">
        {isLoading ? 'Checking…' : connected ? 'Drive connected' : 'Not connected'}
      </div>
    </div>
  );
};

export default DriveStatus;
