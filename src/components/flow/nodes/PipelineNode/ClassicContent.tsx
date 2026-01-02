import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { KVElem } from "../components/KVElem";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "../constants";
import { JsonHelper } from "../../../../utils/jsonHelper";

/**经典风格Pipeline节点内容 */
export const ClassicContent = memo(
  ({ data }: { data: PipelineNodeDataType; props: NodeProps }) => {
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
            {Object.keys(filteredOthers).map((key) => (
              <KVElem key={key} paramKey={key} value={filteredOthers[key]} />
            ))}
            {ExtrasElem}
          </ul>
        </ul>
        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(style.handle, style.target)}
          type="target"
          position={Position.Left}
          style={{ top: "35%" }}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(style.handle, style.targetJumpback)}
          type="target"
          position={Position.Left}
          style={{ top: "65%" }}
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
