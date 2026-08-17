"use client";

import {
  FC,
  useEffect,
  useState,
} from 'react';

import { fetchVersions } from '../../services/explorer';
import type { FileVersion } from '../../types/explorer';

const VersionHistoryPanel: FC<{ fileId?: string | null }> = ({ fileId }) => {
  const [versions, setVersions] = useState<FileVersion[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!fileId) return setVersions([]);
    fetchVersions(fileId).then((d) => { if (mounted) setVersions(d); }).catch(() => {});
    return () => { mounted = false; };
  }, [fileId]);

  if (!fileId) return <div className="p-4">Select a file to view versions.</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">Version History</div>
      <ul className="space-y-2 text-sm">
        {versions.map((v) => (
          <li key={v.id} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-slate-800">{v.createdAt} — {v.size ?? '-'} bytes</li>
        ))}
      </ul>
    </div>
  );
};

export default VersionHistoryPanel;
