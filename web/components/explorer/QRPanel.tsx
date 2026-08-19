"use client";

import { FC, useMemo } from 'react';

const QRPanel: FC<{ fileUrl?: string | null }> = ({ fileUrl }) => {
  const qrSrc = useMemo(() => {
    if (!fileUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  if (!fileUrl) return <div className="p-4 text-sm text-foreground-muted">Select a file to generate a QR code.</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">QR Code</div>
      {qrSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrSrc} alt="QR code for shared file" className="w-48 h-48 bg-white p-2 rounded border border-border" />
      )}
      <p className="mt-2 break-all text-2xs text-foreground-faint">{fileUrl}</p>
    </div>
  );
};

export default QRPanel;
