import { memo, useMemo } from "react";
import { type NodeProps } from "@xyflow/react";

import style from "../../../../styles/flow/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useFlowStore } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { KVElem } from "../components/KVElem";
import { PipelineNodeHandles } from "../components/NodeHandles";
import { SourceHandleTypeEnum, TargetHandleTypeEnum, NodeTypeEnum } from "../constants";
import { JsonHelper } from "../../../../utils/data/jsonHelper";
import {
  mergeFieldSortConfig,
  sortKeysByOrder,
} from "../../../../core/sorting";

/**经典风格Pipeline节点内容 */
export const ClassicContent = memo(
  ({ data, props }: { data: PipelineNodeDataType; props: NodeProps }) => {
    const nodeId = props.id;

    const edges = useFlowStore((state) => state.edges);
    const nodes = useFlowStore((state) => state.nodes);
    const { nextItems, errorItems } = useMemo(() => {
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const outEdges = edges.filter((e) => e.source === nodeId);
      const nextItems: { label: string; variant: "normal" | "jumpback" | "anchor" }[] = [];
      const errorItems: { label: string; variant: "normal" | "jumpback" | "anchor" }[] = [];
      const sorted = [...outEdges].sort((a, b) => a.label - b.label);
      for (const e of sorted) {
        const targetNode = nodeMap.get(e.target);
        const label = (targetNode?.data as any)?.label ?? e.target;
        const isJumpBack = e.targetHandle === TargetHandleTypeEnum.JumpBack;
        const isAnchor = targetNode?.type === NodeTypeEnum.Anchor || !!e.attributes?.anchor;
        const variant = isJumpBack ? "jumpback" : isAnchor ? "anchor" : "normal";
        if (e.sourceHandle === SourceHandleTypeEnum.Next) nextItems.push({ label, variant });
        else if (e.sourceHandle === SourceHandleTypeEnum.Error) errorItems.push({ label, variant });
      }
      return { nextItems, errorItems };
    }, [edges, nodes, nodeId]);

    const showNodeDetailFields = useConfigStore(
      (state) => state.configs.showNodeDetailFields,
    );
    const showNodeFlowSection = useConfigStore(
      (state) => state.configs.showNodeFlowSection,
    );
    const fieldSortConfig = useConfigStore(
      (state) => state.configs.fieldSortConfig,
    );
    const mergedSortConfig = useMemo(
      () => mergeFieldSortConfig(fieldSortConfig),
      [fieldSortConfig],
    );

    const extraEntries = useMemo(() => {
      if (JsonHelper.isObj(data.extras)) {
        return Object.entries(data.extras);
      }
      const extras = JsonHelper.stringObjToJson(data.extras);
      return extras ? Object.entries(extras) : [];
    }, [data.extras]);

    // 过滤空的 focus 字段
    const filteredOthers = useMemo(() => {
      const others = { ...data.others };
      if (
        "focus" in others &&
        (others.focus === "" ||
          others.focus === null ||
          others.focus === undefined ||
          (typeof others.focus === "object" &&
            others.focus !== null &&
            Object.keys(others.focus).length === 0))
      ) {
        delete others.focus;
      }
      return others;
    }, [data.others]);
    const recognitionParamKeys = useMemo(
      () =>
        sortKeysByOrder(
          Object.keys(data.recognition.param),
          mergedSortConfig.recognitionParamFields,
        ),
      [data.recognition.param, mergedSortConfig.recognitionParamFields],
    );
    const actionParamKeys = useMemo(
      () =>
        sortKeysByOrder(
          Object.keys(data.action.param),
          mergedSortConfig.actionParamFields,
        ),
      [data.action.param, mergedSortConfig.actionParamFields],
    );
    const otherParamKeys = useMemo(
      () =>
        sortKeysByOrder(
          Object.keys(filteredOthers),
          mergedSortConfig.mainTaskFields,
        ),
      [filteredOthers, mergedSortConfig.mainTaskFields],
    );

    return (
      <>
        <div className={style.title}>{data.label}</div>
        <ul className={style.list}>
          <ul className={style.module}>
            <KVElem paramKey="recognition" value={data.recognition.type} />
            {showNodeDetailFields &&
              recognitionParamKeys.map((key) => (
                <KVElem
                  key={key}
                  paramKey={key}
                  value={data.recognition.param[key]}
                />
              ))}
          </ul>
          <ul className={style.module}>
            <KVElem paramKey="action" value={data.action.type} />
            {showNodeDetailFields &&
              actionParamKeys.map((key) => (
                <KVElem
                  key={key}
                  paramKey={key}
                  value={data.action.param[key]}
                />
              ))}
          </ul>
          {showNodeDetailFields && (
            <ul className={style.module}>
              {otherParamKeys.map((key) => (
                <KVElem key={key} paramKey={key} value={filteredOthers[key]} />
              ))}
              {extraEntries.map(([key, value]) => (
                <KVElem key={key} paramKey={key} value={value} />
              ))}
            </ul>
          )}
        </ul>
        {showNodeFlowSection && (nextItems.length > 0 || errorItems.length > 0) && (
          <div className={style.flowSection}>
            {nextItems.length > 0 && (
              <div className={style.flowRow}>
                <span className={`${style.flowTag} ${style.flowTagNext}`}>next</span>
                <span className={style.flowArrow}>→</span>
                {nextItems.map((item, i) => (
                  <span key={i} className={`${style.flowTag} ${style.flowTagTarget} ${style[`flowTarget-${item.variant}`]}`}>{item.label}</span>
                ))}
              </div>
            )}
            {errorItems.length > 0 && (
              <div className={style.flowRow}>
                <span className={`${style.flowTag} ${style.flowTagError}`}>on_error</span>
                <span className={style.flowArrow}>→</span>
                {errorItems.map((item, i) => (
                  <span key={i} className={`${style.flowTag} ${style.flowTagTarget} ${style[`flowTarget-${item.variant}`]}`}>{item.label}</span>
                ))}
              </div>
            )}
          </div>
        )}
        <PipelineNodeHandles direction={data.handleDirection} />
      </>
    );
  },
);
