import { memo, useMemo } from "react";
import { type NodeProps } from "@xyflow/react";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { KVElem } from "../components/KVElem";
import { PipelineNodeHandles } from "../components/NodeHandles";
import { JsonHelper } from "../../../../utils/jsonHelper";

/**经典风格Pipeline节点内容 */
export const ClassicContent = memo(
  ({ data }: { data: PipelineNodeDataType; props: NodeProps }) => {
    const showNodeDetailFields = useConfigStore(
      (state) => state.configs.showNodeDetailFields
    );

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

    return (
      <>
        <div className={style.title}>{data.label}</div>
        <ul className={style.list}>
          <ul className={style.module}>
            <KVElem paramKey="recognition" value={data.recognition.type} />
            {showNodeDetailFields && Object.keys(data.recognition.param).map((key) => (
              <KVElem
                key={key}
                paramKey={key}
                value={data.recognition.param[key]}
              />
            ))}
          </ul>
          <ul className={style.module}>
            <KVElem paramKey="action" value={data.action.type} />
            {showNodeDetailFields && Object.keys(data.action.param).map((key) => (
              <KVElem key={key} paramKey={key} value={data.action.param[key]} />
            ))}
          </ul>
          {showNodeDetailFields && (
            <ul className={style.module}>
              {Object.keys(filteredOthers).map((key) => (
                <KVElem key={key} paramKey={key} value={filteredOthers[key]} />
              ))}
              {ExtrasElem}
            </ul>
          )}
        </ul>
        <PipelineNodeHandles direction={data.handleDirection} />
      </>
    );
  }
);
