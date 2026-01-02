import inlineStyle from "../../../styles/InlineFieldPanel.module.less";
import edgeStyle from "../../../styles/EdgePanel.module.less";

import { useMemo, memo, useCallback } from "react";
import { ViewportPortal, useReactFlow, useStore } from "@xyflow/react";
import { Tag, InputNumber, Tooltip, Switch } from "antd";
import classNames from "classnames";

import {
  useFlowStore,
  findNodeLabelById,
  type EdgeType,
  type NodeType,
} from "../../../stores/flow";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../flow/nodes";
import { useConfigStore } from "../../../stores/configStore";
import IconFont from "../../iconfonts";

// 面板默认宽度
const PANEL_WIDTH = 240;

// 获取连接类型信息
const getEdgeTypeTags = (edge: EdgeType, nodes: NodeType[]) => {
  const tags: { label: string; color: string }[] = [];

  // jumpback
  const isJumpBack = edge.targetHandle === TargetHandleTypeEnum.JumpBack;
  if (isJumpBack) {
    tags.push({ label: "jumpback", color: "orange" });
  }

  // anchor
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (targetNode?.type === NodeTypeEnum.Anchor) {
    tags.push({ label: "anchor", color: "blue" });
  }

  // 基础连接类型
  switch (edge.sourceHandle) {
    case SourceHandleTypeEnum.Next:
      tags.push({ label: "next", color: "green" });
      break;
    case SourceHandleTypeEnum.Error:
      tags.push({ label: "on_error", color: "magenta" });
      break;
  }

  return tags;
};

/**内嵌连接面板 - 在边中点附近渲染 */
function InlineEdgePanel() {
  const selectedEdges = useFlowStore((state) => state.selectedEdges);
  const nodes = useFlowStore((state) => state.nodes);
  const targetNode = useFlowStore((state) => state.targetNode);
  const edges = useFlowStore((state) => state.edges);
  const setEdgeLabel = useFlowStore((state) => state.setEdgeLabel);
  const setEdgeData = useFlowStore((state) => state.setEdgeData);
  const updateEdges = useFlowStore((state) => state.updateEdges);
  const fieldPanelMode = useConfigStore(
    (state) => state.configs.fieldPanelMode
  );
  const panelScale = useConfigStore((state) => state.configs.inlinePanelScale);
  const { getNode } = useReactFlow();

  // 判断是否只有一条边被选中且没有选中节点
  const currentEdge = useMemo(() => {
    if (selectedEdges.length === 1 && !targetNode) {
      return selectedEdges[0];
    }
    return null;
  }, [selectedEdges, targetNode]);

  // 使用 useStore 订阅源节点和目标节点的拖拽状态和位置
  const edgeState = useStore((state) => {
    if (!currentEdge) {
      return { isDragging: false, sourcePos: null, targetPos: null };
    }
    const sourceNode = state.nodeLookup.get(currentEdge.source);
    const targetNode = state.nodeLookup.get(currentEdge.target);
    return {
      isDragging: sourceNode?.dragging || targetNode?.dragging || false,
      sourcePos: sourceNode?.position,
      targetPos: targetNode?.position,
    };
  });

  const isDragging = edgeState.isDragging;

  // 计算面板位置（边的中点附近）
  const panelPosition = useMemo(() => {
    if (!currentEdge || !edgeState.sourcePos || !edgeState.targetPos) {
      return { x: 0, y: 0 };
    }

    const sourceNode = getNode(currentEdge.source);
    const targetNode = getNode(currentEdge.target);

    if (!sourceNode || !targetNode) return { x: 0, y: 0 };

    // 计算源节点和目标节点的中心点
    const sourceWidth = sourceNode.measured?.width || sourceNode.width || 200;
    const sourceHeight = sourceNode.measured?.height || sourceNode.height || 50;
    const targetWidth = targetNode.measured?.width || targetNode.width || 200;
    const targetHeight = targetNode.measured?.height || targetNode.height || 50;

    const sourceCenterX = edgeState.sourcePos.x + sourceWidth / 2;
    const sourceCenterY = edgeState.sourcePos.y + sourceHeight / 2;
    const targetCenterX = edgeState.targetPos.x + targetWidth / 2;
    const targetCenterY = edgeState.targetPos.y + targetHeight / 2;

    // 中点位置
    const midX = (sourceCenterX + targetCenterX) / 2;
    const midY = (sourceCenterY + targetCenterY) / 2;

    return {
      x: midX + 20, // 稍微偏移避免遮挡边
      y: midY,
    };
  }, [currentEdge, edgeState.sourcePos, edgeState.targetPos, getNode]);

  // 获取源节点和目标节点的名称
  const { sourceLabel, targetLabel } = useMemo(() => {
    if (!currentEdge) {
      return { sourceLabel: "", targetLabel: "" };
    }
    return {
      sourceLabel: findNodeLabelById(nodes, currentEdge.source) ?? "未知",
      targetLabel: findNodeLabelById(nodes, currentEdge.target) ?? "未知",
    };
  }, [currentEdge, nodes]);

  // 总边数
  const maxOrder = useMemo(() => {
    if (!currentEdge) return 1;
    return edges.filter((e) => {
      if (e.source !== currentEdge.source) return false;
      return e.sourceHandle === currentEdge.sourceHandle;
    }).length;
  }, [currentEdge, edges]);

  // 顺序变更处理
  const handleOrderChange = useCallback(
    (value: number) => {
      if (currentEdge) {
        setEdgeLabel(currentEdge.id, value);
      }
    },
    [currentEdge, setEdgeLabel]
  );

  // jump_back 开关变更处理
  const handleJumpBackChange = useCallback(
    (checked: boolean) => {
      if (currentEdge) {
        setEdgeData(currentEdge.id, "jump_back", checked);
      }
    },
    [currentEdge, setEdgeData]
  );

  // 删除连接
  const handleDelete = useCallback(() => {
    if (currentEdge) {
      updateEdges([{ type: "remove", id: currentEdge.id }]);
    }
  }, [currentEdge, updateEdges]);

  // 只在 inline 模式下渲染
  if (fieldPanelMode !== "inline") {
    return null;
  }

  // 没有选中边时不渲染
  if (!currentEdge) {
    return null;
  }

  // 拖动节点时隐藏面板
  if (isDragging) {
    return null;
  }

  const tags = getEdgeTypeTags(currentEdge, nodes);

  return (
    <ViewportPortal>
      <div
        className={classNames(
          "panel-base",
          "panel-show",
          inlineStyle.inlinePanel,
          edgeStyle.panel
        )}
        style={{
          position: "absolute",
          transform: `translate(${panelPosition.x}px, ${panelPosition.y}px) scale(${panelScale})`,
          width: PANEL_WIDTH,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* 面板头部 */}
        <div className="header">
          <div className="header-left"></div>
          <div className="header-center">
            <div className="title">连接设置</div>
          </div>
          <div className="header-right">
            <Tooltip placement="top" title="删除连接">
              <IconFont
                className="icon-interactive"
                name="icon-shanchu"
                size={18}
                color="#ff4a4a"
                onClick={handleDelete}
              />
            </Tooltip>
          </div>
        </div>

        {/* 面板内容 */}
        <div className={inlineStyle.content}>
          <div className={edgeStyle.info}>
            <div className={edgeStyle["info-item"]}>
              <span className={edgeStyle.label}>源节点</span>
              <span className={edgeStyle.content}>{sourceLabel}</span>
            </div>
            <div className={edgeStyle["info-item"]}>
              <span className={edgeStyle.label}>目标节点</span>
              <span className={edgeStyle.content}>{targetLabel}</span>
            </div>
            <div className={edgeStyle["info-item"]}>
              <span className={edgeStyle.label}>连接类型</span>
              <span className={edgeStyle.content}>
                {tags.map((tag, index) => (
                  <Tag key={index} color={tag.color}>
                    {tag.label}
                  </Tag>
                ))}
              </span>
            </div>
            <div className={edgeStyle["info-item"]}>
              <span className={edgeStyle.label}>顺序</span>
              <span className={edgeStyle.content}>
                <InputNumber
                  size="small"
                  min={1}
                  max={maxOrder}
                  value={currentEdge.label as number}
                  onChange={(val) => val && handleOrderChange(val)}
                  style={{ width: 50 }}
                  controls={true}
                />
                <span style={{ marginLeft: 8, color: "#999", fontSize: 14 }}>
                  / {maxOrder}
                </span>
              </span>
            </div>
          </div>
          {currentEdge.sourceHandle === SourceHandleTypeEnum.Error && (
            <div className={edgeStyle["jumpback-section"]}>
              <div className={edgeStyle["info-item"]}>
                <span className={edgeStyle.label}>JumpBack</span>
                <span className={edgeStyle.content}>
                  <Switch
                    size="small"
                    checked={currentEdge.attributes?.jump_back ?? false}
                    onChange={handleJumpBackChange}
                  />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
}

export default memo(InlineEdgePanel);
