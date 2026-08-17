"use client";

import * as React from 'react';

import * as Popover from '@radix-ui/react-popover';

export function PopoverRoot({ children }: { children: React.ReactNode }) {
  return <Popover.Root>{children}</Popover.Root>;
}

export const PopoverTrigger = Popover.Trigger;
export const PopoverContent = ({ children }: { children: React.ReactNode }) => (
  <Popover.Portal>
    <Popover.Content className="rounded bg-white dark:bg-slate-800 p-3 shadow">{children}</Popover.Content>
  </Popover.Portal>
);

export default Popover;
