import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../styles/nodes.module.less";
import type { ExternalNodeDataType } from "../../../stores/flow";
import { NodeTypeEnum } from "./constants";

/**外部节点内容 */
const ENodeContent = memo(({ data }: { data: ExternalNodeDataType }) => {
  return (
    <>
      <div className={style.title}>{data.label}</div>
      <Handle
        id="target"
        className={classNames(style.handle, style.external)}
        type="target"
        position={Position.Left}
      />
    </>
  );
});

type ExternalNodeData = Node<ExternalNodeDataType, NodeTypeEnum.External>;

/**外部节点组件 */
export function ExternalNode(props: NodeProps<ExternalNodeData>) {
  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["external-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  return (
    <div className={nodeClass}>
      <ENodeContent data={props.data} />
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
  if (prev.data.label !== next.data.label) {
    return false;
  }

  return true;
});
