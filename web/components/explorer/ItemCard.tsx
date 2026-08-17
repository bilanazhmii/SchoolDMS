"use client";

import { FC } from 'react';

import type { FileItem } from '../../types/explorer';

const ItemCard: FC<{ item: FileItem; onClick?: () => void; onContext?: (e: any) => void }> = ({ item, onClick, onContext }) => {
  return (
    <div onContextMenu={onContext} onClick={onClick} className="card p-3">
      <div className="text-sm font-medium truncate">{item.name}</div>
      <div className="text-xs text-muted-foreground">{item.modifiedAt}</div>
    </div>
  );
};

export default ItemCard;
