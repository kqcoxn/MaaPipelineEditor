import style from "../../styles/flow/edges.module.less";
/* eslint-disable react-refresh/only-export-components */

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
  getSmoothStepPath,
  Position,
} from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "../../stores/configStore";
import { useFlowStore } from "../../stores/flow";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
  getHandlePositions,
  DEFAULT_HANDLE_DIRECTION,
  NodeTypeEnum,
} from "./nodes";
import type { HandleDirection } from "./nodes";
import type { EdgeType, NodeType } from "../../stores/flow/types";
import {
  calculateAvoidancePath,
  buildNodeBoundsList,
  DEFAULT_AVOIDANCE_CONFIG,
} from "../../core/avoidanceUtils";
import { useDebugOverlayStore } from "../../stores/debugOverlayStore";

// 判断位置是否为水平方向
function isHorizontalPosition(position: string): boolean {
  return position === "right" || position === "left";
}

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

  const sourceIsHorizontal = isHorizontalPosition(sourcePosition);
  const targetIsHorizontal = isHorizontalPosition(targetPosition);

  // 根据源节点方向计算第一个基础控制点
  if (sourceIsHorizontal) {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP1x = sourcePosition === "right" ? sourceX + offset : sourceX - offset;
    baseCP1y = sourceY;
  } else {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP1x = sourceX;
    baseCP1y =
      sourcePosition === "bottom" ? sourceY + offset : sourceY - offset;
  }

  // 根据目标节点方向计算第二个基础控制点
  if (targetIsHorizontal) {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP2x = targetPosition === "left" ? targetX - offset : targetX + offset;
    baseCP2y = targetY;
  } else {
    const offset = Math.max(baseTangentLen, 30) * tangentScale;
    baseCP2x = targetX;
    baseCP2y = targetPosition === "top" ? targetY - offset : targetY + offset;
  }

  // 两段三次贝塞尔曲线
  // 从源点到拖拽点
  const cp1x = baseCP1x * 0.6 + dragX * 0.4;
  const cp1y = baseCP1y * 0.6 + dragY * 0.4;

  // 计算第一段的切线长度
  const dist1 = Math.sqrt(
    Math.pow(dragX - sourceX, 2) + Math.pow(dragY - sourceY, 2),
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
  const curvature = 0.25;
  const deltaX = Math.abs(targetX - sourceX);
  const deltaY = Math.abs(targetY - sourceY);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  const sourceIsHorizontal = isHorizontalPosition(sourcePosition);
  const targetIsHorizontal = isHorizontalPosition(targetPosition);

  // 根据源节点方向计算第一个控制点
  if (sourceIsHorizontal) {
    const offset = Math.max(deltaX * curvature, 30);
    cp1x = sourcePosition === "right" ? sourceX + offset : sourceX - offset;
    cp1y = sourceY;
  } else {
    const offset = Math.max(deltaY * curvature, 30);
    cp1x = sourceX;
    cp1y = sourcePosition === "bottom" ? sourceY + offset : sourceY - offset;
  }

  // 根据目标节点方向计算第二个控制点
  if (targetIsHorizontal) {
    const offset = Math.max(deltaX * curvature, 30);
    cp2x = targetPosition === "left" ? targetX - offset : targetX + offset;
    cp2y = targetY;
  } else {
    const offset = Math.max(deltaY * curvature, 30);
    cp2x = targetX;
    cp2y = targetPosition === "top" ? targetY - offset : targetY + offset;
  }

  const path = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`;

  // 计算贝塞尔曲线的实际中点 (t=0.5)
  const t = 0.5;
  const mt = 1 - t;
  const labelX =
    mt * mt * mt * sourceX +
    3 * mt * mt * t * cp1x +
    3 * mt * t * t * cp2x +
    t * t * t * targetX;
  const labelY =
    mt * mt * mt * sourceY +
    3 * mt * mt * t * cp1y +
    3 * mt * t * t * cp2y +
    t * t * t * targetY;

  return [path, labelX, labelY];
}

// 将位置字符串转换为 Position 枚举
function positionToEnum(position: string): Position {
  switch (position) {
    case "left":
      return Position.Left;
    case "right":
      return Position.Right;
    case "top":
      return Position.Top;
    case "bottom":
      return Position.Bottom;
    default:
      return Position.Right;
  }
}

// 直角阶梯路径
function getSmoothStepEdgePath({
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
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: positionToEnum(sourcePosition),
    targetPosition: positionToEnum(targetPosition),
    borderRadius: 0,
  });

  return [path, labelX, labelY];
}

// 避让路径
function getAvoidanceEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceId,
  targetId,
  nodes,
  edges,
  edgeId,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  sourceId: string;
  targetId: string;
  nodes: NodeType[];
  edges: EdgeType[];
  edgeId: string;
}): [string, number, number] {
  // 构建节点边界框列表
  const nodeBoundsList = buildNodeBoundsList(nodes).filter((bounds) => {
    const node = nodes.find((n) => n.id === bounds.id);
    return node?.type !== NodeTypeEnum.Group;
  });

  // 排除源节点和目标节点
  const excludeIds = new Set([sourceId, targetId]);

  // 检测平行边（连接相同源节点和目标节点的边）
  const parallelEdges = edges.filter(
    (e) => e.source === sourceId && e.target === targetId,
  );
  const edgeIndex = parallelEdges.findIndex((e) => e.id === edgeId);
  const totalParallelEdges = parallelEdges.length;

  // 计算避让路径
  const result = calculateAvoidancePath(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    sourcePosition,
    targetPosition,
    nodeBoundsList,
    excludeIds,
    DEFAULT_AVOIDANCE_CONFIG,
    edgeIndex,
    totalParallelEdges,
  );

  return [result.path, result.labelX, result.labelY];
}

function MarkedEdge(props: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow();
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint,
  );
  const edgePathMode = useConfigStore((state) => state.configs.edgePathMode);

  // 直接从节点数据获取方向信息、节点列表和边列表
  const { sourceDirection, targetDirection, nodes, edges } = useFlowStore(
    useShallow((state) => {
      const sourceNode = state.nodes.find((n) => n.id === props.source);
      const targetNode = state.nodes.find((n) => n.id === props.target);

      const getSourceDirection = (): HandleDirection => {
        if (sourceNode && "handleDirection" in sourceNode.data) {
          return (
            (sourceNode.data as { handleDirection?: HandleDirection })
              .handleDirection || DEFAULT_HANDLE_DIRECTION
          );
        }
        return DEFAULT_HANDLE_DIRECTION;
      };

      const getTargetDirection = (): HandleDirection => {
        if (targetNode && "handleDirection" in targetNode.data) {
          return (
            (targetNode.data as { handleDirection?: HandleDirection })
              .handleDirection || DEFAULT_HANDLE_DIRECTION
          );
        }
        return DEFAULT_HANDLE_DIRECTION;
      };

      return {
        sourceDirection: getSourceDirection(),
        targetDirection: getTargetDirection(),
        nodes: state.nodes,
        edges: state.edges,
      };
    }),
  );

  // 根据节点方向获取实际的 Handle 位置
  const actualSourcePosition = useMemo(() => {
    const { sourcePosition } = getHandlePositions(sourceDirection);
    return sourcePosition.toLowerCase();
  }, [sourceDirection]);

  const actualTargetPosition = useMemo(() => {
    const { targetPosition } = getHandlePositions(targetDirection);
    return targetPosition.toLowerCase();
  }, [targetDirection]);

  // 控制点拖拽状态
  const [controlOffset, setControlOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 监听重置键
  const edgeControlResetKey = useFlowStore(
    (state) => state.edgeControlResetKey,
  );
  const edgeControlResetTargetIds = useFlowStore(
    (state) => state.edgeControlResetTargetIds,
  );
  useEffect(() => {
    const shouldReset =
      edgeControlResetKey > 0 &&
      (!edgeControlResetTargetIds ||
        edgeControlResetTargetIds.includes(props.id));

    if (shouldReset) {
      setControlOffset({ x: 0, y: 0 });
    }
  }, [edgeControlResetKey, edgeControlResetTargetIds, props.id]);

  // 计算边的路径
  const [edgePath, labelX, labelY] = useMemo(() => {
    // 避让模式：使用避让路径算法
    if (edgePathMode === "avoid") {
      return getAvoidanceEdgePath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: actualSourcePosition,
        targetPosition: actualTargetPosition,
        sourceId: props.source,
        targetId: props.target,
        nodes,
        edges,
        edgeId: props.id,
      });
    }

    // 直角模式：直接使用直角路径
    if (edgePathMode === "smoothstep") {
      return getSmoothStepEdgePath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: actualSourcePosition,
        targetPosition: actualTargetPosition,
      });
    }

    // 贝塞尔模式：支持控制点拖拽
    const hasOffset = controlOffset.x !== 0 || controlOffset.y !== 0;

    if (hasOffset) {
      return getCustomBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: actualSourcePosition,
        targetPosition: actualTargetPosition,
        controlOffset,
      });
    }

    return getStandardBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: actualSourcePosition,
      targetPosition: actualTargetPosition,
    });
  }, [
    props.sourceX,
    props.sourceY,
    props.targetX,
    props.targetY,
    actualSourcePosition,
    actualTargetPosition,
    controlOffset,
    edgePathMode,
    nodes,
    props.source,
    props.target,
    props.id,
    edges,
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
    [controlOffset],
  );

  // 处理拖拽移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

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

  // 获取选中状态和路径状态
  const { selectedNodes, selectedEdges, pathMode, pathEdgeIds } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathEdgeIds: state.pathEdgeIds,
    })),
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

    // 检查是否有便签节点被选中
    const hasStickerSelected = selectedNodes.some(
      (node) => node.type === NodeTypeEnum.Sticker,
    );

    // 如果选中的是便签节点，则不产生聚焦效果
    if (hasStickerSelected) return true;

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

    return classNames(style.edge, markClass);
  }, [
    props.selected,
    props.sourceHandleId,
    props.targetHandleId,
  ]);

  const debugEdgeState = useDebugOverlayStore(
    useShallow((state) => ({
      executed: state.executedEdgeIds.has(props.id),
      candidate: state.candidateEdgeIds.has(props.id),
      executionPath: state.executionPathEdgeIds.has(props.id),
      executionCandidate: state.executionCandidateEdgeIds.has(props.id),
    })),
  );

  const debugEdgeClass = useMemo(
    () =>
      classNames(edgeClass, {
        [style["debug-edge-executed"]]:
          debugEdgeState.executed || debugEdgeState.executionPath,
        [style["debug-edge-candidate"]]:
          debugEdgeState.candidate || debugEdgeState.executionCandidate,
        [style["debug-edge-execution-path"]]: debugEdgeState.executionPath,
        [style["debug-edge-execution-candidate"]]:
          debugEdgeState.executionCandidate,
      }),
    [
      edgeClass,
      debugEdgeState.candidate,
      debugEdgeState.executed,
      debugEdgeState.executionCandidate,
      debugEdgeState.executionPath,
    ],
  );

  const labelClass = useMemo(
    () =>
      classNames({
        [style.label]: true,
        [style["label-selected"]]: props.selected,
      }),
    [props.selected],
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
      <BaseEdge className={debugEdgeClass} id={props.id} path={edgePath} />
      <EdgeLabelRenderer>
        {/* 可拖拽的控制点 */}
        {showEdgeControlPoint && edgePathMode === "bezier" && (
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
