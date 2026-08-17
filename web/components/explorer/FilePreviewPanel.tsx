"use client";

import {
  FC,
  useEffect,
  useState,
} from 'react';

import { fetchPreviewUrl } from '../../services/explorer';
import type { FileItem } from '../../types/explorer';

const FilePreviewPanel: FC<{ file?: FileItem | null }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!file) return setUrl(null);
    fetchPreviewUrl(file.id).then((d) => { if (mounted) setUrl(d.url); }).catch(() => {});
    return () => { mounted = false; };
  }, [file]);

  if (!file) return <div className="p-4">No file selected</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">Preview</div>
      {url ? (
        <iframe src={url} className="w-full h-72 border rounded" title="preview" />
      ) : (
        <div className="h-72 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">Preview not available</div>
      )}
    </div>
  );
};

export default FilePreviewPanel;
