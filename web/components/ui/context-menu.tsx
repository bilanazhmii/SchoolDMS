"use client";

import * as ContextMenu from '@radix-ui/react-context-menu';

export default function ContextMenuWrapper({ children }: { children: React.ReactNode }) {
  return <ContextMenu.Root>{children}</ContextMenu.Root>;
}
