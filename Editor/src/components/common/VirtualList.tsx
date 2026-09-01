import RcVirtualList, {
  type ListRef,
  type ScrollAlign,
} from "@rc-component/virtual-list";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type Key,
  type ReactElement,
  type RefAttributes,
  type UIEventHandler,
} from "react";

export interface VirtualListHandle {
  getScrollOffset: () => number;
  scrollToEnd: () => void;
  scrollToIndex: (index: number, align?: ScrollAlign) => void;
  scrollToOffset: (offset: number) => void;
}

export interface VirtualListProps<T> {
  ariaLabel: string;
  className?: string;
  estimatedItemHeight: number;
  height: number;
  itemKey: (item: T) => Key;
  items: T[];
  onScroll?: UIEventHandler<HTMLElement>;
  onVisibleItemsChange?: (visibleItems: T[], allItems: T[]) => void;
  renderItem: (item: T, index: number) => ReactElement;
}

function VirtualListInner<T>(
  {
    ariaLabel,
    className,
    estimatedItemHeight,
    height,
    itemKey,
    items,
    onScroll,
    onVisibleItemsChange,
    renderItem,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListHandle>,
) {
  const listRef = useRef<ListRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      getScrollOffset: () => listRef.current?.getScrollInfo().y ?? 0,
      scrollToEnd: () => {
        listRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER });
      },
      scrollToIndex: (index, align = "auto") => {
        listRef.current?.scrollTo({ index, align });
      },
      scrollToOffset: (offset) => {
        listRef.current?.scrollTo({ top: offset });
      },
    }),
    [],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentOffset = listRef.current?.getScrollInfo().y ?? 0;
      let nextOffset: number | null = null;
      if (event.key === "ArrowDown") nextOffset = currentOffset + estimatedItemHeight;
      else if (event.key === "ArrowUp") {
        nextOffset = currentOffset - estimatedItemHeight;
      } else if (event.key === "PageDown") nextOffset = currentOffset + height;
      else if (event.key === "PageUp") nextOffset = currentOffset - height;
      else if (event.key === "Home") nextOffset = 0;
      else if (event.key === "End") nextOffset = Number.MAX_SAFE_INTEGER;
      if (nextOffset === null) return;
      event.preventDefault();
      listRef.current?.scrollTo({ top: Math.max(0, nextOffset) });
    },
    [estimatedItemHeight, height],
  );

  const renderVirtualItem = useCallback(
    (item: T, index: number, { style }: { style: React.CSSProperties }) => (
      <div
        data-virtual-row-key={String(itemKey(item))}
        role="listitem"
        aria-posinset={index + 1}
        aria-setsize={items.length}
        style={style}
      >
        {renderItem(item, index)}
      </div>
    ),
    [itemKey, items.length, renderItem],
  );

  return (
    <RcVirtualList
      ref={listRef}
      className={className}
      data={items}
      height={Math.max(1, height)}
      itemHeight={estimatedItemHeight}
      itemKey={itemKey}
      onScroll={onScroll}
      onVisibleChange={onVisibleItemsChange}
      role="list"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      showScrollBar="optional"
    >
      {renderVirtualItem}
    </RcVirtualList>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & RefAttributes<VirtualListHandle>,
) => ReactElement;
