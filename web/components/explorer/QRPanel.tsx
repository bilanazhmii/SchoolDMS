"use client";

import {
  FC,
  useEffect,
  useState,
} from 'react';

const QRPanel: FC<{ fileUrl?: string | null }> = ({ fileUrl }) => {
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return setQrSrc(null);
    // Use quick Google Charts API for QR generation (no backend)
    const src = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(fileUrl)}`;
    setQrSrc(src);
  }, [fileUrl]);

  if (!fileUrl) return <div className="p-4">Select a file to generate QR code.</div>;

  return (
    <div className="p-4">
      <div className="text-sm font-semibold mb-2">QR Code</div>
      {qrSrc && <img src={qrSrc} alt="qr" className="w-48 h-48" />}
    </div>
  );
};

export default QRPanel;
