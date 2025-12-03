import style from "../../styles/nodes.module.less";

import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import {
  useFlowStore,
  type PipelineNodeDataType,
  type ExternalNodeDataType,
  type AnchorNodeDataType,
  type NodeType,
} from "../../stores/flow";
import { JsonHelper } from "../../utils/jsonHelper";

export enum SourceHandleTypeEnum {
  Next = "next",
  Error = "on_error",
}
export enum NodeTypeEnum {
  Pipeline = "pipeline",
  External = "external",
  Anchor = "anchor",
}

/**模块 */
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
    targetNode?: NodeType | null;
  }) => {
    const ExtrasElem = useMemo(() => {
      if (JsonHelper.isObj(data.extras)) {
        return Object.keys(data.extras).map((key) => (
          <KVElem key={key} paramKey={key} value={data.extras[key]} />
        ));
      }
      const extras = JsonHelper.stringObjToJson(data.extras);
      if (extras) {
        return Object.keys(extras).map((key) => (
          <KVElem key={key} paramKey={key} value={extras[key]} />
        ));
      }
      return null;
    }, [data.extras]);

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
            {ExtrasElem}
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
          id={SourceHandleTypeEnum.Error}
          className={classNames(style.handle, style.error)}
          type="source"
          position={Position.Right}
        />
      </>
    );
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
    targetNode?: NodeType | null;
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
      <ENodeContent
        data={props.data}
        props={props}
        targetNode={targetNode as NodeType | undefined}
      />
    </div>
  );
  return Node;
}

/**重定向节点 */
const ANodeContent = memo(
  ({
    data,
  }: {
    data: AnchorNodeDataType;
    props: NodeProps;
    targetNode?: NodeType | null;
  }) => {
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
  }
);

type AnchorNodeData = Node<AnchorNodeDataType, NodeTypeEnum.Anchor>;
function AnchorNode(props: NodeProps<AnchorNodeData>) {
  const targetNode = useFlowStore((state) => state.targetNode);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["anchor-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected]
  );

  const Node = (
    <div className={nodeClass}>
      <ANodeContent
        data={props.data}
        props={props}
        targetNode={targetNode as NodeType | undefined}
      />
    </div>
  );
  return Node;
}

export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: memo(PipelineNode),
  [NodeTypeEnum.External]: memo(ExternalNode),
  [NodeTypeEnum.Anchor]: memo(AnchorNode),
};
