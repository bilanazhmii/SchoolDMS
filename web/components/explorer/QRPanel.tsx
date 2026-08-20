"use client";

import { FC, useMemo } from 'react';

const QRPanel: FC<{ fileUrl?: string | null }> = ({ fileUrl }) => {
  const validUrl = Boolean(fileUrl && /^https?:\/\/[^\s/]+\/s\/[^\s/]+$/.test(fileUrl));
  const qrSrc = useMemo(() => {
    if (!validUrl || !fileUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl, validUrl]);

  if (!fileUrl || !validUrl) {
    return <div className="p-4 text-sm text-foreground-muted">Buat share link VIEW untuk menghasilkan QR guest yang valid.</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-2 text-sm font-semibold">QR Code</div>
      {qrSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrSrc} alt="QR code for shared file" className="h-48 w-48 rounded border border-border bg-white p-2" />
      )}
      <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-2xs text-primary hover:underline">
        {fileUrl}
      </a>
    </div>
  );
};

export default QRPanel;
