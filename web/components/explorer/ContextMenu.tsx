"use client";

import { FC } from 'react';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const ContextMenu: FC<{ onRename?: () => void; onCopy?: () => void; onMove?: () => void; onDelete?: () => void }> = ({ onRename, onCopy, onMove, onDelete }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Content align="end" className="rounded bg-white dark:bg-slate-800 p-2 shadow">
        <DropdownMenu.Item onSelect={onRename} className="px-3 py-1">Rename</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onCopy} className="px-3 py-1">Copy</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onMove} className="px-3 py-1">Move</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onDelete} className="px-3 py-1 text-red-600">Delete</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

export default ContextMenu;
