"use client";

import * as Sheet from '@radix-ui/react-dialog';

export function SheetRoot({ children }: { children: React.ReactNode }) {
  return <Sheet.Root>{children}</Sheet.Root>;
}

export const SheetTrigger = Sheet.Trigger;
export const SheetContent = ({ children }: { children: React.ReactNode }) => (
  <Sheet.Portal>
    <Sheet.Overlay className="fixed inset-0 bg-black/50" />
    <Sheet.Content className="fixed right-0 top-0 h-full w-[80vw] bg-white dark:bg-slate-800 p-4">{children}</Sheet.Content>
  </Sheet.Portal>
);

export default Sheet;
