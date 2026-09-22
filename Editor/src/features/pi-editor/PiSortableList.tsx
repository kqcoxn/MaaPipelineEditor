import { useRef, type ReactNode } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';
import { usePiEditorStore as store } from './store';
import type { PiTab } from './types';
import styles from './PiSortableList.module.less';

function SortableRow({ id, label, disabled, className, children }: {
  id: string; label: string; disabled: boolean; className?: string; children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = <button type="button" ref={setActivatorNodeRef} className={styles.handle} {...attributes} {...listeners}
    disabled={disabled} aria-label={`拖动排序 ${label}`} title="拖动排序；空格开始，方向键移动，空格确认，Esc 取消"
    onClick={event => { event.preventDefault(); event.stopPropagation(); }}><HolderOutlined /></button>;
  return <div role="listitem" ref={setNodeRef} className={[styles.row, className].filter(Boolean).join(' ')} data-dragging={isDragging}
    style={{ transform: CSS.Translate.toString(transform), transition }}>{children(handle)}</div>;
}

/** One drag commits one raw JSON edit. A changed draft cancels a pending drag. */
export function PiSortableList<T>({ tab, pointer, items, itemKey, itemLabel, renderItem, label, disabled = false, className, rowClassName }: {
  tab: PiTab; pointer: string; items: T[]; itemKey: (item: T) => string; itemLabel: (item: T) => string;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode; label: string;
  disabled?: boolean; className?: string; rowClassName?: string;
}) {
  const busy = store(s => s.busy);
  const initial = useRef('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const occurrences = new Map<string, number>();
  const rows = items.map(item => {
    const key = itemKey(item); const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { item, id: JSON.stringify([key, occurrence]) };
  });
  const locked = disabled || busy || items.length < 2;
  return <DndContext sensors={sensors} collisionDetection={closestCenter}
    accessibility={{ screenReaderInstructions: { draggable: '按空格开始排序，使用上下方向键移动，再按空格确认，按 Esc 取消。' }, announcements: {
      onDragStart: () => `开始调整${label}顺序。`,
      onDragOver: ({ over }) => over ? `目标位置 ${rows.findIndex(row => row.id === over.id) + 1}。` : undefined,
      onDragEnd: () => '排序结束。', onDragCancel: () => '已取消排序。',
    } }}
    onDragStart={() => { initial.current = tab.content; }}
    onDragEnd={({ active, over }) => {
      if (locked || !over || active.id === over.id || store.getState().tabs.find(t => t.path === tab.path)?.content !== initial.current) return;
      const from = rows.findIndex(row => row.id === active.id); const to = rows.findIndex(row => row.id === over.id);
      if (from >= 0 && to >= 0) store.getState().reorder(tab.path, pointer, from, to);
    }}>
    <SortableContext items={rows.map(row => row.id)} strategy={verticalListSortingStrategy}>
      <div role="list" aria-label={label} className={className}>
        {rows.map(({ item, id }, index) => <SortableRow key={id} id={id} label={itemLabel(item)} disabled={locked} className={rowClassName}>{handle => renderItem(item, index, handle)}</SortableRow>)}
      </div>
    </SortableContext>
  </DndContext>;
}
