"use client";

import {
  useCallback,
  useState,
} from 'react';

import type {
  ExplorerSort,
  ExplorerView,
} from '../types/explorer';

export function useExplorer() {
  const [view, setView] = useState<ExplorerView>('grid');
  const [sort, setSort] = useState<ExplorerSort>('modified');
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  return { view, setView, sort, setSort, selected, toggleSelect, clearSelection };
}
