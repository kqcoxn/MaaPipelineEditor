import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { KVElem } from "../components/KVElem";
import { SourceHandleTypeEnum } from "../constants";
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
          id={SourceHandleTypeEnum.JumpBack}
          className={classNames(style.handle, style.jumpback)}
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
