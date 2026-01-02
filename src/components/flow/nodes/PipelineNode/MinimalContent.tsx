import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import IconFont from "../../../iconfonts";
import { getRecognitionIcon, getMinimalNodeColor } from "../utils";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "../constants";

/**极简风格Pipeline节点 */
export const MinimalContent = memo(
  ({ data }: { data: PipelineNodeDataType; props: NodeProps }) => {
    // 获取识别类型对应的图标和颜色
    const recoType = data.recognition.type;
    const recoIconConfig = useMemo(
      () => getRecognitionIcon(recoType),
      [recoType]
    );
    const colorConfig = useMemo(
      () => getMinimalNodeColor(recoType),
      [recoType]
    );

    return (
      <>
        {/* 节点主体 */}
        <div
          className={style.minimalBody}
          style={{
            borderColor: colorConfig.primary,
            backgroundColor: colorConfig.background,
          }}
        >
          {/* 图标区域 */}
          <div
            className={style.minimalIconWrapper}
            style={{ color: colorConfig.primary }}
          >
            {recoIconConfig.name ? (
              <IconFont name={recoIconConfig.name} size={28} />
            ) : (
              <IconFont name="icon-m_act" size={28} />
            )}
          </div>
        </div>

        {/* 节点名称 */}
        <div className={style.minimalLabel} title={data.label}>
          {data.label}
        </div>

        {/* Handle  */}
        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(style.minimalHandle, style.minimalTarget)}
          type="target"
          position={Position.Left}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(
            style.minimalHandle,
            style.minimalTargetJumpback
          )}
          type="target"
          position={Position.Left}
        />
        <Handle
          id={SourceHandleTypeEnum.Next}
          className={classNames(style.minimalHandle, style.minimalNext)}
          type="source"
          position={Position.Right}
        />
        <Handle
          id={SourceHandleTypeEnum.Error}
          className={classNames(style.minimalHandle, style.minimalError)}
          type="source"
          position={Position.Right}
        />
      </>
    );
  }
);
