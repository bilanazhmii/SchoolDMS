"use client";

import * as React from 'react';

export default function Avatar({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      {src ? <img src={src} alt={alt} className="w-full h-full object-cover" /> : <span className="text-sm">{(alt ?? 'U').charAt(0)}</span>}
    </div>
  );
}
