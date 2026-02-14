import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../styles/nodes.module.less";
import type { StickerNodeDataType, StickerColorTheme } from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { NodeTypeEnum } from "./constants";
import { NodeContextMenu } from "./components/NodeContextMenu";
import type { NodeContextMenuNode } from "./nodeContextMenu";

/**便签颜色主题配置 */
export const STICKER_COLOR_THEMES: Record<
  StickerColorTheme,
  { bg: string; border: string; headerBg: string; text: string }
> = {
  yellow: {
    bg: "#fff9c4",
    border: "#f9e066",
    headerBg: "#f9e066",
    text: "#5d4e00",
  },
  green: {
    bg: "#e8f5e9",
    border: "#81c784",
    headerBg: "#81c784",
    text: "#1b5e20",
  },
  blue: {
    bg: "#e3f2fd",
    border: "#64b5f6",
    headerBg: "#64b5f6",
    text: "#0d47a1",
  },
  pink: {
    bg: "#fce4ec",
    border: "#f06292",
    headerBg: "#f06292",
    text: "#880e4f",
  },
  purple: {
    bg: "#f3e5f5",
    border: "#ba68c8",
    headerBg: "#ba68c8",
    text: "#4a148c",
  },
};

type StickerNodeData = Node<StickerNodeDataType, NodeTypeEnum.Sticker>;

/**便签节点内容 */
const StickerContent = memo(
  ({
    data,
    nodeId,
    selected,
  }: {
    data: StickerNodeDataType;
    nodeId: string;
    selected?: boolean;
  }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);
    const [editing, setEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const theme = STICKER_COLOR_THEMES[data.color] || STICKER_COLOR_THEMES.yellow;

    // 双击进入编辑
    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(true);
      },
      []
    );

    // 退出编辑
    const handleBlur = useCallback(() => {
      setEditing(false);
      saveHistory(0);
    }, [saveHistory]);

    // 内容变化
    const handleContentChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNodeData(nodeId, "sticker", "content", e.target.value);
      },
      [nodeId, setNodeData]
    );

    // 标题变化
    const handleTitleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(nodeId, "direct", "label", e.target.value);
      },
      [nodeId, setNodeData]
    );

    // 聚焦到 textarea
    useEffect(() => {
      if (editing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
      }
    }, [editing]);

    return (
      <div
        className={style.stickerInner}
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          color: theme.text,
        }}
      >
        {/* 标题栏 */}
        <div
          className={style.stickerHeader}
          style={{ backgroundColor: theme.headerBg }}
        >
          <input
            className={style.stickerTitle}
            value={data.label}
            onChange={handleTitleChange}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ color: "#fff" }}
            placeholder="便签标题"
          />
        </div>

        {/* 内容区 */}
        <div
          className={style.stickerBody}
          onDoubleClick={handleDoubleClick}
        >
          {editing ? (
            <textarea
              ref={textareaRef}
              className={style.stickerTextarea}
              value={data.content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="双击编辑内容..."
              style={{ color: theme.text }}
            />
          ) : (
            <div className={style.stickerText}>
              {data.content || (
                <span className={style.stickerPlaceholder}>
                  双击编辑内容...
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

/**便签节点组件 */
export function StickerNode(props: NodeProps<StickerNodeData>) {
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 便签节点始终不受聚焦效果影响
  const isRelated = true;

  const theme =
    STICKER_COLOR_THEMES[props.data.color] || STICKER_COLOR_THEMES.yellow;

  const nodeClass = useMemo(
    () =>
      classNames({
        [style["sticker-node"]]: true,
        [style["sticker-node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const node = {
    id: props.id,
    type: NodeTypeEnum.Sticker,
    data: props.data,
    position: { x: props.positionAbsoluteX ?? 0, y: props.positionAbsoluteY ?? 0 },
  } as unknown as NodeContextMenuNode;

  return (
    <NodeContextMenu
      node={node}
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
    >
      <div className={nodeClass}>
        <NodeResizer
          minWidth={140}
          minHeight={100}
          isVisible={props.selected}
          lineStyle={{ borderColor: theme.border }}
          handleStyle={{ backgroundColor: theme.border, borderColor: "#fff" }}
        />
        <StickerContent
          data={props.data}
          nodeId={props.id}
          selected={props.selected}
        />
      </div>
    </NodeContextMenu>
  );
}

export const StickerNodeMemo = memo(StickerNode, (prev, next) => {
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  const prevData = prev.data;
  const nextData = next.data;

  if (
    prevData.label !== nextData.label ||
    prevData.content !== nextData.content ||
    prevData.color !== nextData.color
  ) {
    return false;
  }

  return true;
});
