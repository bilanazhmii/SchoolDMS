import api from '../lib/axios';

export type SyncTarget = {
  id: string;
  relativeRoot: string;
  localPath: string;
  active: boolean;
  updatedAt: string;
};

export type SyncDevice = {
  id: string;
  deviceIdentifier: string;
  hostname: string | null;
  machineName: string | null;
  clientVersion: string | null;
  status: string;
  platform: string;
  lastSeen: string | null;
  online: boolean;
  targetCount: number;
  activeTargetCount: number;
  targets: SyncTarget[];
};

export type SyncStatus = {
  devices: SyncDevice[];
  onlineCount: number;
  sessions: Array<{ id: string; sessionKey: string; status: string; startedAt: string; updatedAt: string }>;
  recentJobs: Array<{ id: string; operation: string; status: string; message: string | null; createdAt: string; finishedAt: string | null; session: { sessionKey: string } }>;
  totals: { all: number; synced: number; failed: number };
  lastSyncAt: string | null;
  generatedAt: string;
};

export async function getSyncStatus(): Promise<SyncStatus> {
  const response = await api.get<{ success: boolean; data: SyncStatus }>('/sync/status');
  return response.data.data;
}
