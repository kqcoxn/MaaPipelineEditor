import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../styles/nodes.module.less";
import type { GroupNodeDataType, GroupColorTheme } from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import { NodeTypeEnum } from "./constants";
import { NodeContextMenu } from "./components/NodeContextMenu";
import type { NodeContextMenuNode } from "./nodeContextMenu";

/**分组颜色主题配置 */
export const GROUP_COLOR_THEMES: Record<
  GroupColorTheme,
  { bg: string; border: string; headerBg: string; text: string }
> = {
  blue: {
    bg: "rgba(24, 144, 255, 0.06)",
    border: "rgba(24, 144, 255, 0.4)",
    headerBg: "rgba(24, 144, 255, 0.12)",
    text: "#1890ff",
  },
  green: {
    bg: "rgba(82, 196, 26, 0.06)",
    border: "rgba(82, 196, 26, 0.4)",
    headerBg: "rgba(82, 196, 26, 0.12)",
    text: "#52c41a",
  },
  purple: {
    bg: "rgba(114, 46, 209, 0.06)",
    border: "rgba(114, 46, 209, 0.4)",
    headerBg: "rgba(114, 46, 209, 0.12)",
    text: "#722ed1",
  },
  orange: {
    bg: "rgba(250, 140, 22, 0.06)",
    border: "rgba(250, 140, 22, 0.4)",
    headerBg: "rgba(250, 140, 22, 0.12)",
    text: "#fa8c16",
  },
  gray: {
    bg: "rgba(0, 0, 0, 0.03)",
    border: "rgba(0, 0, 0, 0.2)",
    headerBg: "rgba(0, 0, 0, 0.06)",
    text: "#666",
  },
};

type GroupNodeData = Node<GroupNodeDataType, NodeTypeEnum.Group>;

/**分组节点内容 */
const GroupContent = memo(
  ({
    data,
    nodeId,
  }: {
    data: GroupNodeDataType;
    nodeId: string;
  }) => {
    const setNodeData = useFlowStore((state) => state.setNodeData);
    const saveHistory = useFlowStore((state) => state.saveHistory);
    const inputRef = useRef<HTMLInputElement>(null);

    const theme =
      GROUP_COLOR_THEMES[data.color] || GROUP_COLOR_THEMES.blue;

    // 标题变化
    const handleTitleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNodeData(nodeId, "direct", "label", e.target.value);
      },
      [nodeId, setNodeData]
    );

    const handleTitleBlur = useCallback(() => {
      saveHistory(0);
    }, [saveHistory]);

    return (
      <div
        className={style.groupInner}
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
        }}
      >
        {/* 标题栏 */}
        <div
          className={style.groupHeader}
          style={{ backgroundColor: theme.headerBg }}
        >
          <input
            ref={inputRef}
            className={style.groupTitle}
            value={data.label}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ color: theme.text }}
            placeholder="分组名称"
          />
        </div>

        {/* 内容区（子节点渲染在此区域上方） */}
        <div className={style.groupBody} />
      </div>
    );
  }
);

/**分组节点组件 */
export function GroupNode(props: NodeProps<GroupNodeData>) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const theme =
    GROUP_COLOR_THEMES[props.data.color] || GROUP_COLOR_THEMES.blue;

  const nodeClass = useMemo(
    () =>
      classNames({
        [style["group-node"]]: true,
        [style["group-node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const node = {
    id: props.id,
    type: NodeTypeEnum.Group,
    data: props.data,
    position: {
      x: props.positionAbsoluteX ?? 0,
      y: props.positionAbsoluteY ?? 0,
    },
  } as unknown as NodeContextMenuNode;

  return (
    <NodeContextMenu
      node={node}
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
    >
      <div className={nodeClass}>
        <NodeResizer
          minWidth={200}
          minHeight={150}
          isVisible={props.selected}
          lineStyle={{ borderColor: theme.border }}
          handleStyle={{
            backgroundColor: theme.border,
            borderColor: "#fff",
          }}
        />
        <GroupContent data={props.data} nodeId={props.id} />
      </div>
    </NodeContextMenu>
  );
}

export const GroupNodeMemo = memo(GroupNode, (prev, next) => {
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
    prevData.color !== nextData.color
  ) {
    return false;
  }

  return true;
});
