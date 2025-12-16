import { memo, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useFlowStore } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { NodeTypeEnum } from "../constants";
import { ModernContent } from "./ModernContent";
import { ClassicContent } from "./ClassicContent";
import { useShallow } from "zustand/shallow";

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;

/**Pipeline节点组件 */
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);

  // 获取选中状态和边信息
  const { selectedNodes, selectedEdges, edges } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      edges: state.edges,
    }))
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    // 透明度为1
    if (focusOpacity === 1) return true;
    // 没有选中任何内容
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    // 当前节点被选中
    if (props.selected) return true;

    const nodeId = props.id;

    // 检查是否与选中的节点直接连接
    for (const selectedNode of selectedNodes) {
      // 查找与选中节点相连的边
      for (const edge of edges) {
        if (
          (edge.source === selectedNode.id && edge.target === nodeId) ||
          (edge.target === selectedNode.id && edge.source === nodeId)
        ) {
          return true;
        }
      }
    }

    // 检查是否与选中的边相连
    for (const selectedEdge of selectedEdges) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) {
        return true;
      }
    }

    return false;
  }, [
    focusOpacity,
    selectedNodes,
    selectedEdges,
    edges,
    props.id,
    props.selected,
  ]);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: props.selected,
        [style["modern-node"]]: nodeStyle === "modern",
      }),
    [props.selected, nodeStyle]
  );

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

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
