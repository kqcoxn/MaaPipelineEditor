import { useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";
import { useFileStore } from "@/stores/project/fileStore";

/** The workspace owns mixed tab order; Pipeline retains its relative order in its cache. */
export function useFileTabOrder<T extends { key: string }>(items: T[]) {
  const [order, setOrder] = useState<string[]>([]);
  const tabs = useMemo(() => {
    const byKey = new Map(items.map(item => [item.key, item]));
    const retained = order.flatMap(key => {
      const item = byKey.get(key);
      byKey.delete(key);
      return item ? [item] : [];
    });
    return [...retained, ...byKey.values()];
  }, [items, order]);

  useEffect(() => {
    const keys = tabs.map(tab => tab.key);
    setOrder(previous => previous.length === keys.length && previous.every((key, i) => key === keys[i]) ? previous : keys);
  }, [tabs]);

  useEffect(() => useFileStore.subscribe((state, previous) => {
    const oldName = previous.currentFile.fileName;
    const newName = state.currentFile.fileName;
    // Renames also happen when a local file is first saved. Keep its position.
    if (oldName !== newName && !state.files.some(file => file.fileName === oldName) &&
      previous.files.length === state.files.length &&
      previous.files.findIndex(file => file.fileName === oldName) === state.files.findIndex(file => file.fileName === newName)) {
      setOrder(keys => keys.map(key => key === oldName ? newName : key));
    }
  }), []);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = tabs.findIndex(tab => tab.key === active.id);
    const to = tabs.findIndex(tab => tab.key === over.id);
    if (from < 0 || to < 0) return;
    const keys = arrayMove(tabs, from, to).map(tab => tab.key);
    setOrder(keys);
    useFileStore.setState(state => ({ files: [...state.files].sort((a, b) => keys.indexOf(a.fileName) - keys.indexOf(b.fileName)) }));
  };
  return { tabs, onDragEnd };
}
