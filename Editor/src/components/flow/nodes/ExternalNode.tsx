import { memo, useMemo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../styles/flow/nodes.module.less";
import type { ExternalNodeDataType } from "../../../stores/flow";
import { getNodeTypeLabelKey, useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "./constants";
import { useNodeFocusState } from "../focusSelectors";
import { ExternalNodeHandles } from "./components/NodeHandles";

/**外部节点内容 */
const ENodeContent = memo(
  ({
    data,
    replicaCount,
  }: {
    data: ExternalNodeDataType;
    replicaCount: number;
  }) => {
    return (
      <>
        <div className={style.title}>
          <span className={style["title-text"]}>{data.label}</span>
          {replicaCount > 0 && (
            <span
              className={style["replica-badge"]}
              title={`此外部引用共有 ${replicaCount + 1} 个视觉副本`}
            >
              +{replicaCount}
            </span>
          )}
        </div>
        <ExternalNodeHandles direction={data.handleDirection} />
      </>
    );
  },
);

type ExternalNodeData = Node<ExternalNodeDataType, NodeTypeEnum.External>;

/**外部节点组件 */
export function ExternalNode(props: NodeProps<ExternalNodeData>) {
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  // 视觉副本数量（同 label 的其他 External 节点）
  const replicaCount = useFlowStore((state) =>
    Math.max(
      0,
      (state.nodeIdsByTypeAndLabel.get(
        getNodeTypeLabelKey(NodeTypeEnum.External, props.data.label),
      )?.size ?? 0) - 1,
    ),
  );

  const { isRelated } = useNodeFocusState({
    nodeId: props.id,
    selected: props.selected,
    focusOpacity,
  });

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["external-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected],
  );

  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  return (
    <div className={nodeClass} style={opacityStyle}>
      <ENodeContent data={props.data} replicaCount={replicaCount} />
    </div>
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
