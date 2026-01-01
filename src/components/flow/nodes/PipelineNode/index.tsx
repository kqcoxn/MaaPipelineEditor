import { memo, useMemo, useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import debugStyle from "../../../../styles/DebugPanel.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useFlowStore } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { useDebugStore } from "../../../../stores/debugStore";
import { NodeTypeEnum } from "../constants";
import { ModernContent } from "./ModernContent";
import { ClassicContent } from "./ClassicContent";
import { useShallow } from "zustand/shallow";
import { NodeContextMenu } from "../components/NodeContextMenu";

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;

/**Pipeline节点组件 */
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
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

  // 获取调试状态
  const debugMode = useDebugStore((state) => state.debugMode);
  const executedNodes = useDebugStore((state) => state.executedNodes);
  const currentNode = useDebugStore((state) => state.currentNode);
  const breakpoints = useDebugStore((state) => state.breakpoints);

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    // 透明度为1或当前节点被选中
    if (focusOpacity === 1 || props.selected) return true;

    // 路径模式
    if (pathMode && pathNodeIds.size > 0) {
      return pathNodeIds.has(props.id);
    }

    // 没有选中任何内容
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;

    const nodeId = props.id;

    // 检查是否与选中的边相连
    for (const selectedEdge of selectedEdges) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) {
        return true;
      }
    }

    // 仅在有选中节点时检查节点连接关系
    if (selectedNodes.length > 0) {
      // 预先构建选中节点ID集合
      const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

      // 只检查与当前节点相关的边
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
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: props.selected,
        [style["modern-node"]]: nodeStyle === "modern",
        // 调试相关样式
        [debugStyle["debug-node-executed"]]:
          debugMode && executedNodes.has(props.id),
        [debugStyle["debug-node-executing"]]:
          debugMode && currentNode === props.id,
      }),
    [props.selected, nodeStyle, debugMode, executedNodes, currentNode, props.id]
  );

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  if (!node) {
    return (
      <div className={nodeClass} style={opacityStyle}>
        {nodeStyle === "modern" ? (
          <ModernContent data={props.data} props={props} />
        ) : (
          <ClassicContent data={props.data} props={props} />
        )}
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
        {/* 断点标记 */}
        {debugMode && breakpoints.has(props.id) && (
          <div className={debugStyle["debug-node-breakpoint"]} />
        )}
        {nodeStyle === "modern" ? (
          <ModernContent data={props.data} props={props} />
        ) : (
          <ClassicContent data={props.data} props={props} />
        )}
      </div>
    </NodeContextMenu>
  );
}

export const PipelineNodeMemo = memo(PipelineNode, (prev, next) => {
  // 基础属性比较
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  // 比较 data
  const prevData = prev.data;
  const nextData = next.data;
  if (prevData.label !== nextData.label) {
    return false;
  }

  if (prevData.recognition.type !== nextData.recognition.type) {
    return false;
  }
  try {
    if (
      JSON.stringify(prevData.recognition.param) !==
      JSON.stringify(nextData.recognition.param)
    ) {
      return false;
    }
  } catch {
    if (prevData.recognition.param !== nextData.recognition.param) {
      return false;
    }
  }

  if (prevData.action.type !== nextData.action.type) {
    return false;
  }
  try {
    if (
      JSON.stringify(prevData.action.param) !==
      JSON.stringify(nextData.action.param)
    ) {
      return false;
    }
  } catch {
    if (prevData.action.param !== nextData.action.param) {
      return false;
    }
  }

  if (
    prevData.others !== nextData.others ||
    prevData.extras !== nextData.extras
  ) {
    return false;
  }

  return true;
});
