"use client";

import * as React from 'react';

export default function ScrollArea({ children }: { children: React.ReactNode }) {
  return <div className="overflow-auto max-h-[70vh]">{children}</div>;
}
