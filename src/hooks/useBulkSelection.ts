import { useState, useMemo, useCallback, useEffect, useRef } from "react";

export function useBulkSelection<T extends { id: string }>(items: T[] | undefined, options?: { preserveAcrossItems?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggledRef = useRef<string | null>(null);
  const itemCacheRef = useRef<Map<string, T>>(new Map());
  const preserveAcrossItems = options?.preserveAcrossItems ?? false;

  if (items) {
    items.forEach((item) => itemCacheRef.current.set(item.id, item));
  }

  useEffect(() => {
    items?.forEach((item) => itemCacheRef.current.set(item.id, item));
  }, [items]);

  // Limpa seleção de IDs que sumiram da lista (filtro mudou, item removido, etc.)
  useEffect(() => {
    if (preserveAcrossItems || !items || selectedIds.size === 0) return;
    const visible = new Set(items.map(i => i.id));
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => {
      if (visible.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [items, preserveAcrossItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string, opts?: { shiftKey?: boolean }) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      // Range select com Shift
      if (opts?.shiftKey && lastToggledRef.current && items) {
        const lastIdx = items.findIndex(i => i.id === lastToggledRef.current);
        const curIdx = items.findIndex(i => i.id === id);
        if (lastIdx >= 0 && curIdx >= 0) {
          const [from, to] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
          const willSelect = !next.has(id);
          for (let i = from; i <= to; i++) {
            if (willSelect) next.add(items[i].id);
            else next.delete(items[i].id);
          }
          lastToggledRef.current = id;
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastToggledRef.current = id;
      return next;
    });
  }, [items, preserveAcrossItems]);

  const toggleAll = useCallback(() => {
    if (!items) return;
    setSelectedIds(prev => {
      const next = preserveAcrossItems ? new Set(prev) : new Set<string>();
      const allVisibleSelected = items.length > 0 && items.every((item) => prev.has(item.id));
      items.forEach((item) => {
        if (allVisibleSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, []);

  const allSelected = !!items && items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someSelected = !!items && items.some((item) => selectedIds.has(item.id)) && !allSelected;

  const selectedItems = useMemo(() => {
    const currentItems = new Map(items?.map((item) => [item.id, item]) ?? []);
    return Array.from(selectedIds)
      .map((id) => currentItems.get(id) ?? itemCacheRef.current.get(id))
      .filter(Boolean) as T[];
  }, [items, selectedIds]);

  return {
    selectedIds,
    selectedItems,
    count: selectedIds.size,
    allSelected,
    someSelected,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    toggleAll,
    clear,
    selectMany,
  };
}
