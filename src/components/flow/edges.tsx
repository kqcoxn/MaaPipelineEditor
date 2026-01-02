import style from "../../styles/edges.module.less";
import debugStyle from "../../styles/DebugPanel.module.less";

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
} from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "../../stores/configStore";
import { useFlowStore } from "../../stores/flow";
import { useDebugStore } from "../../stores/debugStore";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "./nodes";

// 计算带控制点偏移的贝塞尔曲线路径
function getCustomBezierPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  controlOffset,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  controlOffset: { x: number; y: number };
}): [string, number, number] {
  // 计算源点到目标点的实际距离和方向
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX);

  // 计算真实中点
  const trueMidX = sourceX + deltaX / 2;
  const trueMidY = sourceY + deltaY / 2;

  // 拖拽点位置
  const dragX = trueMidX + controlOffset.x;
  const dragY = trueMidY + controlOffset.y;

  // 计算拖拽点到连线的垂直距离
  const perpDist =
    Math.abs((dragX - sourceX) * deltaY - (dragY - sourceY) * deltaX) /
    distance;

  // 根据距离动态调整控制点强度
  const curvature = 0.25;
  const baseTangentLen = distance * curvature;

  // 太远时减小切线长度
  const maxPerpDist = distance * 0.4;
  const tangentScale =
    perpDist > maxPerpDist
      ? Math.max(0.3, 1 - (perpDist - maxPerpDist) / distance)
      : 1;

  // 计算基础控制点方向
  let baseCP1x: number, baseCP1y: number, baseCP2x: number, baseCP2y: number;

  if (sourcePosition === "right" || sourcePosition === "left") {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP1x = sourcePosition === "right" ? sourceX + offset : sourceX - offset;
    baseCP1y = sourceY;
    baseCP2x = targetPosition === "left" ? targetX - offset : targetX + offset;
    baseCP2y = targetY;
  } else {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP1x = sourceX;
    baseCP1y =
      sourcePosition === "bottom" ? sourceY + offset : sourceY - offset;
    baseCP2x = targetX;
    baseCP2y = targetPosition === "top" ? targetY - offset : targetY + offset;
  }

  // 两段三次贝塞尔曲线
  // 从源点到拖拽点
  const cp1x = baseCP1x * 0.6 + dragX * 0.4;
  const cp1y = baseCP1y * 0.6 + dragY * 0.4;

  // 计算第一段的切线长度
  const dist1 = Math.sqrt(
    Math.pow(dragX - sourceX, 2) + Math.pow(dragY - sourceY, 2)
  );
  const tangentLen1 = Math.min(dist1 * 0.3, baseTangentLen) * tangentScale;
  const angle1 = Math.atan2(dragY - sourceY, dragX - sourceX);
  const cp2x = dragX - Math.cos(angle1) * tangentLen1;
  const cp2y = dragY - Math.sin(angle1) * tangentLen1;

  // 第二段的第一个控制点
  const cp3x = dragX + (dragX - cp2x);
  const cp3y = dragY + (dragY - cp2y);

  // 第二段的第二个控制点
  const cp4x = baseCP2x * 0.6 + dragX * 0.4;
  const cp4y = baseCP2y * 0.6 + dragY * 0.4;

  // 切线连续
  const path = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${dragX} ${dragY} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${targetX} ${targetY}`;

  return [path, dragX, dragY];
}

// 标准贝塞尔路径
function getStandardBezierPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
}): [string, number, number] {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const curvature = 0.25;
  const deltaX = Math.abs(targetX - sourceX);
  const deltaY = Math.abs(targetY - sourceY);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (sourcePosition === "right" || sourcePosition === "left") {
    const offset = deltaX * curvature;
    cp1x = sourcePosition === "right" ? sourceX + offset : sourceX - offset;
    cp1y = sourceY;
    cp2x = targetPosition === "left" ? targetX - offset : targetX + offset;
    cp2y = targetY;
  } else {
    const offset = deltaY * curvature;
    cp1x = sourceX;
    cp1y = sourcePosition === "bottom" ? sourceY + offset : sourceY - offset;
    cp2x = targetX;
    cp2y = targetPosition === "top" ? targetY - offset : targetY + offset;
  }

  const path = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`;

  return [path, midX, midY];
}

function MarkedEdge(props: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow();
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint
  );

  // 控制点拖拽状态
  const [controlOffset, setControlOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 监听重置键
  const edgeControlResetKey = useFlowStore(
    (state) => state.edgeControlResetKey
  );
  useEffect(() => {
    if (edgeControlResetKey > 0) {
      setControlOffset({ x: 0, y: 0 });
    }
  }, [edgeControlResetKey]);

  // 计算贝塞尔曲线路径
  const [edgePath, labelX, labelY] = useMemo(() => {
    const hasOffset = controlOffset.x !== 0 || controlOffset.y !== 0;

    if (hasOffset) {
      return getCustomBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition ?? "bottom",
        targetPosition: props.targetPosition ?? "top",
        controlOffset,
      });
    }

    return getStandardBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition ?? "bottom",
      targetPosition: props.targetPosition ?? "top",
    });
  }, [
    props.sourceX,
    props.sourceY,
    props.targetX,
    props.targetY,
    props.sourcePosition,
    props.targetPosition,
    controlOffset,
  ]);

  // 处理拖拽开始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialOffsetRef.current = { ...controlOffset };
    },
    [controlOffset]
  );

  // 处理拖拽移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      // 计算屏幕坐标的差值
      const deltaScreenX = e.clientX - dragStartRef.current.x;
      const deltaScreenY = e.clientY - dragStartRef.current.y;

      // 将屏幕坐标转换为 flow 坐标差值
      // 获取起始点和当前点的 flow 坐标
      const startFlow = screenToFlowPosition({
        x: dragStartRef.current.x,
        y: dragStartRef.current.y,
      });
      const currentFlow = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const deltaX = currentFlow.x - startFlow.x;
      const deltaY = currentFlow.y - startFlow.y;

      setControlOffset({
        x: initialOffsetRef.current.x + deltaX,
        y: initialOffsetRef.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, screenToFlowPosition]);

  // 双击重置控制点
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setControlOffset({ x: 0, y: 0 });
  }, []);

  const edge = useFlowStore((state) =>
    state.edges.find((e) => e.id === props.id)
  );

  // 获取选中状态和路径状态
  const { selectedNodes, selectedEdges, pathMode, pathEdgeIds } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathEdgeIds: state.pathEdgeIds,
    }))
  );

  // 获取调试状态
  const { debugMode, executedNodes } = useDebugStore(
    useShallow((state) => ({
      debugMode: state.debugMode,
      executedNodes: state.executedNodes,
    }))
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    if (focusOpacity === 1) return true;

    // 路径模式
    if (pathMode && pathEdgeIds.size > 0) {
      return pathEdgeIds.has(props.id);
    }

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    if (props.selected) return true;

    // 检查边是否连接到选中的节点
    for (const selectedNode of selectedNodes) {
      if (
        props.source === selectedNode.id ||
        props.target === selectedNode.id
      ) {
        return true;
      }
    }

    return false;
  }, [
    focusOpacity,
    selectedNodes,
    selectedEdges,
    props.source,
    props.target,
    props.selected,
    props.id,
    pathMode,
    pathEdgeIds,
  ]);

  const edgeClass = useMemo(() => {
    let markClass = "";
    if (props.selected) {
      markClass = style["edge-selected"];
    } else {
      const isJumpBack = props.targetHandleId === TargetHandleTypeEnum.JumpBack;

      switch (props.sourceHandleId) {
        case SourceHandleTypeEnum.Next:
          markClass = isJumpBack ? style["edge-jumpback"] : style["edge-next"];
          break;
        case SourceHandleTypeEnum.Error:
          markClass = isJumpBack
            ? style["edge-error-jumpback"]
            : style["edge-error"];
          break;
      }
    }

    // 如果 source 和 target 都已执行，则边也标记为已执行
    const isExecuted =
      debugMode &&
      executedNodes.has(props.source) &&
      executedNodes.has(props.target);

    return classNames(
      style.edge,
      markClass,
      isExecuted && debugStyle["debug-edge-executed"]
    );
  }, [
    props.selected,
    props.sourceHandleId,
    props.targetHandleId,
    props.source,
    props.target,
    debugMode,
    executedNodes,
  ]);

  const labelClass = useMemo(
    () =>
      classNames({
        [style.label]: true,
        [style["label-selected"]]: props.selected,
      }),
    [props.selected]
  );
  const labelStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
    };
    // 应用透明度
    if (!isRelated && focusOpacity !== 1) {
      baseStyle.opacity = focusOpacity;
    }
    return baseStyle;
  }, [labelX, labelY, isRelated, focusOpacity]);

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  // 是否有偏移
  const hasOffset = controlOffset.x !== 0 || controlOffset.y !== 0;

  // 控制点样式
  const controlPointStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
      cursor: isDragging ? "grabbing" : "grab",
    };
    // 拖拽过的控制点需要显示
    if (hasOffset && !isDragging) {
      baseStyle.opacity = 0.7;
    }
    // 应用聚焦透明度
    if (!isRelated && focusOpacity !== 1) {
      baseStyle.opacity = focusOpacity;
    }
    return baseStyle;
  }, [labelX, labelY, isDragging, hasOffset, isRelated, focusOpacity]);

  return (
    <g style={opacityStyle}>
      <BaseEdge className={edgeClass} id={props.id} path={edgePath} />
      <EdgeLabelRenderer>
        {/* 可拖拽的控制点 */}
        {showEdgeControlPoint && (
          <div
            className={classNames(style["control-point"], {
              [style["control-point-dragging"]]: isDragging,
              [style["control-point-offset"]]:
                controlOffset.x !== 0 || controlOffset.y !== 0,
            })}
            style={controlPointStyle}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title="拖拽调整路径，双击重置"
          />
        )}
        {/* 标签 */}
        {showEdgeLabel && props.label != null ? (
          <div className={labelClass} style={labelStyle}>
            {props.label}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </g>
  );
}

export const edgeTypes = {
  marked: memo(MarkedEdge),
};
