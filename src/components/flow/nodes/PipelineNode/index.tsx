import { memo, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { NodeTypeEnum } from "../constants";
import { ModernContent } from "./ModernContent";
import { ClassicContent } from "./ClassicContent";

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;

/**Pipeline节点组件 */
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);

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

  return (
    <div className={nodeClass}>
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
  if (
    prevData.recognition.type !== nextData.recognition.type ||
    prevData.recognition.param !== nextData.recognition.param
  ) {
    return false;
  }
  if (
    prevData.action.type !== nextData.action.type ||
    prevData.action.param !== nextData.action.param
  ) {
    return false;
  }
  if (
    prevData.others !== nextData.others ||
    prevData.extras !== nextData.extras
  ) {
    return false;
  }

  return true;
});
