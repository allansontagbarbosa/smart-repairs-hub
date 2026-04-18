import { useState, useMemo, useCallback, useEffect, useRef } from "react";

export function useBulkSelection<T extends { id: string }>(items: T[] | undefined) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastToggledRef = useRef<string | null>(null);

  // Limpa seleção de IDs que sumiram da lista (filtro mudou, item removido, etc.)
  useEffect(() => {
    if (!items || selectedIds.size === 0) return;
    const visible = new Set(items.map(i => i.id));
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => {
      if (visible.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [items]);

  const toggleAll = useCallback(() => {
    if (!items) return;
    setSelectedIds(prev =>
      prev.size === items.length ? new Set() : new Set(items.map(i => i.id))
    );
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const allSelected = !!items && items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const selectedItems = useMemo(
    () => items?.filter(i => selectedIds.has(i.id)) ?? [],
    [items, selectedIds],
  );

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
  };
}
