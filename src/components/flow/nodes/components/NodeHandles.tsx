import { memo, useMemo, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, useNodeId } from "@xyflow/react";
import classNames from "classnames";

import style from "../../../../styles/nodes.module.less";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "../constants";
import type { HandleDirection } from "../constants";
import { DEFAULT_HANDLE_DIRECTION } from "../constants";

/**获取 Handle 位置配置 */
function getHandlePositions(direction: HandleDirection): {
  targetPosition: Position;
  sourcePosition: Position;
  isVertical: boolean;
} {
  switch (direction) {
    case "left-right":
      return { targetPosition: Position.Left, sourcePosition: Position.Right, isVertical: false };
    case "right-left":
      return { targetPosition: Position.Right, sourcePosition: Position.Left, isVertical: false };
    case "top-bottom":
      return { targetPosition: Position.Top, sourcePosition: Position.Bottom, isVertical: true };
    case "bottom-top":
      return { targetPosition: Position.Bottom, sourcePosition: Position.Top, isVertical: true };
    default:
      return { targetPosition: Position.Left, sourcePosition: Position.Right, isVertical: false };
  }
}

interface PipelineNodeHandlesProps {
  direction?: HandleDirection;
  /** 是否使用极简风格样式 */
  minimal?: boolean;
}

/**Pipeline 节点端点组件 */
export const PipelineNodeHandles = memo<PipelineNodeHandlesProps>(
  ({ direction = DEFAULT_HANDLE_DIRECTION, minimal = false }) => {
    const nodeId = useNodeId();
    const updateNodeInternals = useUpdateNodeInternals();
    
    const { targetPosition, sourcePosition, isVertical } = useMemo(
      () => getHandlePositions(direction),
      [direction]
    );

    // 方向改变
    useEffect(() => {
      if (nodeId) {
        // 确保更新生效
        updateNodeInternals(nodeId);
        const timer1 = setTimeout(() => updateNodeInternals(nodeId), 0);
        const timer2 = setTimeout(() => updateNodeInternals(nodeId), 50);
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }, [direction, nodeId, updateNodeInternals]);

    // 根据方向和风格选择样式类
    const handleClass = minimal
      ? isVertical
        ? style.minimalHandleVertical
        : style.minimalHandle
      : isVertical
        ? style.handleVertical
        : style.handle;

    const targetClass = minimal
      ? isVertical
        ? style.minimalTargetVertical
        : style.minimalTarget
      : isVertical
        ? style.targetVertical
        : style.target;

    const targetJumpbackClass = minimal
      ? isVertical
        ? style.minimalTargetJumpbackVertical
        : style.minimalTargetJumpback
      : isVertical
        ? style.targetJumpbackVertical
        : style.targetJumpback;

    const nextClass = minimal
      ? isVertical
        ? style.minimalNextVertical
        : style.minimalNext
      : isVertical
        ? style.nextVertical
        : style.next;

    const errorClass = minimal
      ? isVertical
        ? style.minimalErrorVertical
        : style.minimalError
      : isVertical
        ? style.errorVertical
        : style.error;

    return (
      <>
        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(handleClass, targetClass)}
          type="target"
          position={targetPosition}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(handleClass, targetJumpbackClass)}
          type="target"
          position={targetPosition}
        />
        <Handle
          id={SourceHandleTypeEnum.Next}
          className={classNames(handleClass, nextClass)}
          type="source"
          position={sourcePosition}
        />
        <Handle
          id={SourceHandleTypeEnum.Error}
          className={classNames(handleClass, errorClass)}
          type="source"
          position={sourcePosition}
        />
      </>
    );
  }
);

PipelineNodeHandles.displayName = "PipelineNodeHandles";

interface ExternalNodeHandlesProps {
  direction?: HandleDirection;
}

/**External 节点端点组件 */
export const ExternalNodeHandles = memo<ExternalNodeHandlesProps>(
  ({ direction = DEFAULT_HANDLE_DIRECTION }) => {
    const nodeId = useNodeId();
    const updateNodeInternals = useUpdateNodeInternals();
    
    const { targetPosition, isVertical } = useMemo(
      () => getHandlePositions(direction),
      [direction]
    );

    // 方向改变
    useEffect(() => {
      if (nodeId) {
        updateNodeInternals(nodeId);
        const timer1 = setTimeout(() => updateNodeInternals(nodeId), 0);
        const timer2 = setTimeout(() => updateNodeInternals(nodeId), 50);
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }, [direction, nodeId, updateNodeInternals]);

    const handleClass = isVertical ? style.handleVertical : style.handle;
    const externalStyle = isVertical
      ? { left: "30%" }
      : { top: "30%" };
    const jumpbackStyle = isVertical
      ? { left: "70%" }
      : { top: "70%" };

    return (
      <>
        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(handleClass, style.external)}
          type="target"
          position={targetPosition}
          style={externalStyle}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(handleClass, isVertical ? style.targetJumpbackVertical : style.targetJumpback)}
          type="target"
          position={targetPosition}
          style={jumpbackStyle}
        />
      </>
    );
  }
);

ExternalNodeHandles.displayName = "ExternalNodeHandles";

interface AnchorNodeHandlesProps {
  direction?: HandleDirection;
}

/**Anchor 节点端点组件 */
export const AnchorNodeHandles = memo<AnchorNodeHandlesProps>(
  ({ direction = DEFAULT_HANDLE_DIRECTION }) => {
    const nodeId = useNodeId();
    const updateNodeInternals = useUpdateNodeInternals();
    
    const { targetPosition, isVertical } = useMemo(
      () => getHandlePositions(direction),
      [direction]
    );

    // 方向改变
    useEffect(() => {
      if (nodeId) {
        updateNodeInternals(nodeId);
        const timer1 = setTimeout(() => updateNodeInternals(nodeId), 0);
        const timer2 = setTimeout(() => updateNodeInternals(nodeId), 50);
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }, [direction, nodeId, updateNodeInternals]);

    const handleClass = isVertical ? style.handleVertical : style.handle;
    const anchorStyle = isVertical
      ? { left: "30%" }
      : { top: "30%" };
    const jumpbackStyle = isVertical
      ? { left: "70%" }
      : { top: "70%" };

    return (
      <>
        <Handle
          id={TargetHandleTypeEnum.Target}
          className={classNames(handleClass, style.anchor)}
          type="target"
          position={targetPosition}
          style={anchorStyle}
        />
        <Handle
          id={TargetHandleTypeEnum.JumpBack}
          className={classNames(handleClass, isVertical ? style.targetJumpbackVertical : style.targetJumpback)}
          type="target"
          position={targetPosition}
          style={jumpbackStyle}
        />
      </>
    );
  }
);

AnchorNodeHandles.displayName = "AnchorNodeHandles";

export { getHandlePositions };
