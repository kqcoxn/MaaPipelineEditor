import { memo, useMemo, useState } from "react";
import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";

import style from "../../../styles/nodes.module.less";
import type { ExternalNodeDataType } from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { NodeTypeEnum } from "./constants";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { ExternalNodeHandles } from "./components/NodeHandles";

/**外部节点内容 */
const ENodeContent = memo(({ data }: { data: ExternalNodeDataType }) => {
  return (
    <>
      <div className={style.title}>
        <span className={style["title-text"]}>{data.label}</span>
      </div>
      <ExternalNodeHandles direction={data.handleDirection} />
    </>
  );
});

type ExternalNodeData = Node<ExternalNodeDataType, NodeTypeEnum.External>;

/**外部节点组件 */
export function ExternalNode(props: NodeProps<ExternalNodeData>) {
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<ExternalNodeDataType, NodeTypeEnum.External>
    | undefined;

  // 获取选中状态、边信息和路径状态
  const { selectedNodes, selectedEdges, pathMode, pathNodeIds } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathNodeIds: state.pathNodeIds,
    }))
  );
  const edges = useFlowStore((state) => state.edges);

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    if (focusOpacity === 1 || props.selected) return true;

    // 路径模式
    if (pathMode && pathNodeIds.size > 0) {
      return pathNodeIds.has(props.id);
    }

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;

    const nodeId = props.id;
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // 检查是否有便签节点被选中
    const hasStickerSelected = selectedNodes.some(
      (node) => node.type === NodeTypeEnum.Sticker
    );

    // 如果选中的是便签节点，则不产生聚焦效果
    if (hasStickerSelected) return true;

    // 检查分组关系
    const thisNode = useFlowStore.getState().nodes.find((n) => n.id === nodeId);
    if (thisNode && (thisNode as any).parentId && selectedNodeIds.has((thisNode as any).parentId)) {
      return true;
    }

    // 检查是否与选中的边相连
    for (const selectedEdge of selectedEdges) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) {
        return true;
      }
    }

    // 仅在有选中节点时检查节点连接关系
    if (selectedNodes.length > 0) {
      for (const edge of edges) {
        if (edge.target === nodeId && selectedNodeIds.has(edge.source)) {
          return true;
        }
        if (edge.source === nodeId && selectedNodeIds.has(edge.target)) {
          return true;
        }
      }
    }

    return false;
  }, [
    focusOpacity,
    props.selected,
    pathMode,
    pathNodeIds,
    props.id,
    selectedNodes,
    selectedEdges,
    edges,
  ]);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["external-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  if (!node) {
    return (
      <div className={nodeClass} style={opacityStyle}>
        <ENodeContent data={props.data} />
      </div>
    );
  }

  return (
    <NodeContextMenu
      node={node}
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
    >
      <div className={nodeClass} style={opacityStyle}>
        <ENodeContent data={props.data} />
      </div>
    </NodeContextMenu>
  );
}

export const ExternalNodeMemo = memo(ExternalNode, (prev, next) => {
  // 基础属性比较
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  // data 字段比较
  if (
    prev.data.label !== next.data.label ||
    prev.data.handleDirection !== next.data.handleDirection
  ) {
    return false;
  }

  return true;
});
