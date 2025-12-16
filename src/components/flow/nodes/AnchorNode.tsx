import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";

import style from "../../../styles/nodes.module.less";
import type { AnchorNodeDataType } from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { NodeTypeEnum } from "./constants";

/**重定向节点内容 */
const ANodeContent = memo(({ data }: { data: AnchorNodeDataType }) => {
  return (
    <>
      <div className={style.title}>{data.label}</div>
      <Handle
        id="target"
        className={classNames(style.handle, style.anchor)}
        type="target"
        position={Position.Left}
      />
    </>
  );
});

type AnchorNodeData = Node<AnchorNodeDataType, NodeTypeEnum.Anchor>;

/**重定向节点组件 */
export function AnchorNode(props: NodeProps<AnchorNodeData>) {
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
    if (focusOpacity === 1) return true;
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    if (props.selected) return true;

    const nodeId = props.id;

    for (const selectedNode of selectedNodes) {
      for (const edge of edges) {
        if (
          (edge.source === selectedNode.id && edge.target === nodeId) ||
          (edge.target === selectedNode.id && edge.source === nodeId)
        ) {
          return true;
        }
      }
    }

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
        [style["anchor-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  return (
    <div className={nodeClass} style={opacityStyle}>
      <ANodeContent data={props.data} />
    </div>
  );
}

export const AnchorNodeMemo = memo(AnchorNode, (prev, next) => {
  // 基础属性比较
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  // data 字段比较
  if (prev.data.label !== next.data.label) {
    return false;
  }

  return true;
});
