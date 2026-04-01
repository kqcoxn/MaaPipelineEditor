import { memo, useMemo } from "react";
import { type NodeProps } from "@xyflow/react";

import style from "../../../../styles/flow/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { KVElem } from "../components/KVElem";
import { PipelineNodeHandles } from "../components/NodeHandles";
import { JsonHelper } from "../../../../utils/data/jsonHelper";
import {
  mergeFieldSortConfig,
  sortKeysByOrder,
} from "../../../../core/sorting";

/**经典风格Pipeline节点内容 */
export const ClassicContent = memo(
  ({ data }: { data: PipelineNodeDataType; props: NodeProps }) => {
    const showNodeDetailFields = useConfigStore(
      (state) => state.configs.showNodeDetailFields,
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
        <PipelineNodeHandles direction={data.handleDirection} />
      </>
    );
  },
);
