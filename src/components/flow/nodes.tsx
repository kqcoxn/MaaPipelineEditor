import style from "../../styles/nodes.module.less";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import {
  useFlowStore,
  type PipelineNodeDataType,
  type ExternalNodeDataType,
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
function KVElem(key: string, value: any = "") {
  return (
    <li key={key}>
      <div className={style.key}>{key}</div>
      <div className={style.value}>
        <div className={style.container}>
          {JsonHelper.objToString(value) ?? String(value) ?? ""}
        </div>
      </div>
    </li>
  );
}

type PipelineNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;
function PipelineNode({ data, selected }: NodeProps<PipelineNodeData>) {
  useFlowStore((state) => state.targetNode);

  const ParamList = (
    <ul className={style.list}>
      <ul className={style.module}>
        {KVElem("recognition", data.recognition.type)}
        {Object.keys(data.recognition.param).map((key) =>
          KVElem(key, data.recognition.param[key])
        )}
      </ul>
      <ul className={style.module}>
        {KVElem("action", data.action.type)}
        {Object.keys(data.action.param).map((key) =>
          KVElem(key, data.action.param[key])
        )}
      </ul>
      <ul className={style.module}>
        {Object.keys(data.others).map((key) => KVElem(key, data.others[key]))}
        {JsonHelper.isStringObj(data.extras)
          ? KVElem("extras", data.extras)
          : null}
      </ul>
    </ul>
  );

  return (
    <div
      className={classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: selected,
      })}
    >
      <div className={style.title}>{data.label}</div>
      {ParamList}
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
    </div>
  );
}

type ExternalNodeData = Node<ExternalNodeDataType, NodeTypeEnum.External>;
function ExternalNode({ data, selected }: NodeProps<ExternalNodeData>) {
  useFlowStore((state) => state.targetNode);

  return (
    <div
      className={classNames({
        [style.node]: true,
        [style["external-node"]]: true,
        [style["node-selected"]]: selected,
      })}
    >
      <div className={style.title}>{data.label}</div>
      <Handle
        id="target"
        className={classNames(style.handle, style.external)}
        type="target"
        position={Position.Left}
      />
    </div>
  );
}

export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: memo(PipelineNode),
  [NodeTypeEnum.External]: memo(ExternalNode),
};
