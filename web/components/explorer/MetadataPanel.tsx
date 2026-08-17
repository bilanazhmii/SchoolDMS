"use client";

import {
  FC,
  useEffect,
  useState,
} from 'react';

import { fetchFile } from '../../services/explorer';
import type { FileItem } from '../../types/explorer';

const MetadataPanel: FC<{ fileId?: string | null }> = ({ fileId }) => {
  const [meta, setMeta] = useState<FileItem | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!fileId) return setMeta(null);
    fetchFile(fileId).then((d) => { if (mounted) setMeta(d); }).catch(() => {});
    return () => { mounted = false; };
  }, [fileId]);

  if (!meta) return <div className="p-4">Select a file to see metadata.</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold">Metadata</div>
      <div className="mt-2 text-sm">
        <div><strong>Name:</strong> {meta.name}</div>
        <div><strong>Type:</strong> {meta.mimeType ?? '-'}</div>
        <div><strong>Size:</strong> {meta.size ?? '-'} bytes</div>
        <div><strong>Modified:</strong> {meta.modifiedAt}</div>
        <div><strong>Created:</strong> {meta.createdAt}</div>
      </div>
    </div>
  );
};

export default MetadataPanel;
