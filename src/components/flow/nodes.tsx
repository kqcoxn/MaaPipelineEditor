import style from "../../styles/nodes.module.less";

import { memo, useMemo, type JSX } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import {
  useFlowStore,
  type PipelineNodeDataType,
  type ExternalNodeDataType,
  type NodeType,
} from "../../stores/flowStore";
import { JsonHelper } from "../../utils/jsonHelper";

export enum SourceHandleTypeEnum {
  Next = "next",
  Interrupt = "interrupt",
  Error = "on_error",
}
export enum NodeTypeEnum {
  Pipeline = "pipeline",
  External = "external",
}

/**模块 */
function isUpdateNodeContent(pre: any, post: any) {
  return post.targetNode != null && !post.props.dragging;
}

const KVElem = memo(({ paramKey, value }: { paramKey: string; value: any }) => {
  return (
    <li key={paramKey}>
      <div className={style.key}>{paramKey}</div>
      <div className={style.value}>
        <div className={style.container}>
          {JsonHelper.objToString(value) ?? String(value) ?? ""}
        </div>
      </div>
    </li>
  );
});

/**内部节点 */
const PNodeDataContent = memo(
  ({
    data,
  }: {
    data: PipelineNodeDataType;
    props: NodeProps;
    targetNode?: NodeType;
  }) => {
    return (
      <>
        <div className={style.title}>{data.label}</div>
        <ul className={style.list}>
          <ul className={style.module}>
            <KVElem paramKey="recognition" value={data.recognition.type} />
            {Object.keys(data.recognition.param).map((key) => (
              <KVElem
                key={key}
                paramKey={key}
                value={data.recognition.param[key]}
              />
            ))}
          </ul>
          <ul className={style.module}>
            <KVElem paramKey="action" value={data.action.type} />
            {Object.keys(data.action.param).map((key) => (
              <KVElem key={key} paramKey={key} value={data.action.param[key]} />
            ))}
          </ul>
          <ul className={style.module}>
            {Object.keys(data.others).map((key) => (
              <KVElem key={key} paramKey={key} value={data.others[key]} />
            ))}
            {JsonHelper.isStringObj(data.extras) ? (
              <KVElem paramKey={"extras"} value={data.extras} />
            ) : null}
          </ul>
        </ul>
        <Handle
          id="target"
          className={classNames(style.handle, style.target)}
          type="target"
          position={Position.Left}
        />
        <Handle
          id={SourceHandleTypeEnum.Next}
          className={classNames(style.handle, style.next)}
          type="source"
          position={Position.Right}
        />
        <Handle
          id={SourceHandleTypeEnum.Interrupt}
          className={classNames(style.handle, style.interrupt)}
          type="source"
          position={Position.Right}
        />
        <Handle
          id={SourceHandleTypeEnum.Error}
          className={classNames(style.handle, style.error)}
          type="source"
          position={Position.Right}
        />
      </>
    );
  },
  (pre, post) => {
    return !isUpdateNodeContent(pre, post);
  }
);

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;
function PipelineNode(props: NodeProps<PNodeData>) {
  const targetNode = useFlowStore((state) => state.targetNode) as
    | NodeType
    | undefined;

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  return (
    <div className={nodeClass}>
      <PNodeDataContent
        data={props.data}
        props={props}
        targetNode={targetNode}
      />
    </div>
  );
}

/**外部节点 */
const ENodeContent = memo(
  ({
    data,
  }: {
    data: ExternalNodeDataType;
    props: NodeProps;
    targetNode?: NodeType;
  }) => {
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
  },
  (pre, post) => {
    return !isUpdateNodeContent(pre, post);
  }
);

type ExternalNodeData = Node<ExternalNodeDataType, NodeTypeEnum.External>;
function ExternalNode(props: NodeProps<ExternalNodeData>) {
  const targetNode = useFlowStore((state) => state.targetNode);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["external-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const Node = (
    <div className={nodeClass}>
      <ENodeContent data={props.data} props={props} targetNode={targetNode} />
    </div>
  );
  return Node;
}

export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: memo(PipelineNode),
  [NodeTypeEnum.External]: memo(ExternalNode),
};
