"use client";

import { useCallback } from 'react';

import { useExplorerContext } from '../providers/explorer-provider';

export function useExplorer() {
  const { view, setView, sort, setSort, selection, setSelection } = useExplorerContext();

  const toggleSelect = useCallback((id: string) => {
    setSelection(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
  }, [selection, setSelection]);

  const clearSelection = useCallback(() => setSelection([]), [setSelection]);

  return { view, setView, sort, setSort, selected: selection, setSelection, toggleSelect, clearSelection };
}
