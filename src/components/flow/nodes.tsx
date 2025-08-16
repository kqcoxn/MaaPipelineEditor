import style from "../../styles/nodes.module.less";

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import classNames from "classnames";

import { useFlowStore, type NodeDataType } from "../../stores/flowStore";
import { JsonHelper } from "../../utils/jsonHelper";

type PipelineNodeData = Node<NodeDataType, "pipeline">;

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

function ParamListElem(data: NodeDataType) {
  return (
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
}

function PipelineNode({ data, selected }: NodeProps<PipelineNodeData>) {
  const currentNode = useFlowStore((state) => state.targetNode);
  return (
    <div
      className={classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style.selected]: selected,
      })}
    >
      <div className={style.title}>{data.label}</div>
      {ParamListElem(data)}
    </div>
  );
}

export const nodeTypes = {
  pipelineNode: memo(PipelineNode),
};
