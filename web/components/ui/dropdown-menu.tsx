"use client";

import * as React from 'react';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function Dropdown({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Root>{children}</DropdownMenu.Root>;
}

export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownContent = ({ children }: { children: React.ReactNode }) => (
  <DropdownMenu.Portal>
    <DropdownMenu.Content className="rounded bg-white dark:bg-slate-800 p-2 shadow">{children}</DropdownMenu.Content>
  </DropdownMenu.Portal>
);

export default DropdownMenu;
