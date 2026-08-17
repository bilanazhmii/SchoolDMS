import * as React from 'react';

export default function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-white dark:bg-slate-800 p-4 shadow-sm">{children}</div>;
}
