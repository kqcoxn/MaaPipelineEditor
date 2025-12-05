import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../styles/nodes.module.less";
import type { AnchorNodeDataType } from "../../../stores/flow";
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
  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["anchor-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  return (
    <div className={nodeClass}>
      <ANodeContent data={props.data} />
    </div>
  );
}

export const AnchorNodeMemo = memo(AnchorNode);
