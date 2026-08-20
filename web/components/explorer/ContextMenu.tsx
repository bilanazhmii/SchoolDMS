"use client";

import { FC } from 'react';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '../ui';

const ContextMenu: FC<{
  label: string;
  onRename?: () => void;
  onCopy?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}> = ({ label, onRename, onCopy, onMove, onDelete }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${label}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-[80] min-w-40 rounded-md border border-border bg-card p-1 shadow-lg">
          <DropdownMenu.Item onSelect={onRename} className="cursor-pointer rounded px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-hover">Rename</DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onCopy} className="cursor-pointer rounded px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-hover">Make a copy</DropdownMenu.Item>
          {onMove && <DropdownMenu.Item onSelect={onMove} className="cursor-pointer rounded px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-hover">Move</DropdownMenu.Item>}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={onDelete} className="cursor-pointer rounded px-3 py-2 text-sm text-danger outline-none hover:bg-danger/10">Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default ContextMenu;
