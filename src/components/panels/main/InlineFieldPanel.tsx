import inlineStyle from "../../../styles/InlineFieldPanel.module.less";
import fieldStyle from "../../../styles/FieldPanel.module.less";

import { useMemo, memo, useCallback, useState } from "react";
import { ViewportPortal, useReactFlow, useStore } from "@xyflow/react";
import { Spin } from "antd";
import classNames from "classnames";

import {
  useFlowStore,
  type PipelineNodeType,
  type ExternalNodeType,
  type AnchorNodeType,
  type StickerNodeType,
} from "../../../stores/flow";
import { NodeTypeEnum } from "../../flow/nodes";
import {
  PipelineEditorWithSuspense,
  ExternalEditor,
  AnchorEditor,
  StickerEditor,
} from "../node-editors";
import { FieldPanelToolbarLeft, FieldPanelToolbarRight } from "../field/tools";
import { useConfigStore } from "../../../stores/configStore";

// 面板与节点的间距
const PANEL_GAP = 20;
// 面板默认宽度
const PANEL_WIDTH = 220;

/**内嵌字段面板 - 在节点旁边渲染 */
function InlineFieldPanel() {
  const currentNode = useFlowStore((state) => state.targetNode);
  const updateNodes = useFlowStore((state) => state.updateNodes);
  const fieldPanelMode = useConfigStore(
    (state) => state.configs.fieldPanelMode
  );
  // 从配置中获取缩放比例
  const panelScale = useConfigStore((state) => state.configs.inlinePanelScale);
  const { getNode } = useReactFlow();

  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressDetail, setProgressDetail] = useState("");

  // 使用 useStore 订阅节点的 dragging 状态和实时位置变化（响应式）
  const nodeState = useStore((state) => {
    if (!currentNode) return { isDragging: false, position: { x: 0, y: 0 } };
    const node = state.nodeLookup.get(currentNode.id);
    return {
      isDragging: node?.dragging ?? false,
      position: node?.position || currentNode.position,
    };
  });

  const isDragging = nodeState.isDragging;

  // 获取完整的节点数据（包含 width/height）
  const fullNode = currentNode ? getNode(currentNode.id) : null;
  const nodeWidth = fullNode?.measured?.width || fullNode?.width || 200;

  // 计算面板位置（节点右侧），使用实时位置
  const panelPosition = useMemo(() => {
    if (!currentNode) return { x: 0, y: 0 };
    return {
      x: nodeState.position.x + nodeWidth + PANEL_GAP,
      y: nodeState.position.y,
    };
  }, [nodeState.position.x, nodeState.position.y, nodeWidth, currentNode]);

  // 删除节点
  const handleDelete = useCallback(() => {
    if (currentNode) {
      updateNodes([{ type: "remove", id: currentNode.id }]);
    }
  }, [currentNode, updateNodes]);

  // 进度变化回调
  const handleProgressChange = useCallback((stage: string, detail?: string) => {
    setProgressStage(stage);
    setProgressDetail(detail || "");
  }, []);

  // 渲染编辑器内容
  const renderEditor = useMemo(() => {
    if (!currentNode) return null;

    switch (currentNode.type) {
      case NodeTypeEnum.Pipeline:
        return (
          <PipelineEditorWithSuspense
            currentNode={currentNode as PipelineNodeType}
          />
        );
      case NodeTypeEnum.External:
        return <ExternalEditor currentNode={currentNode as ExternalNodeType} />;
      case NodeTypeEnum.Anchor:
        return <AnchorEditor currentNode={currentNode as AnchorNodeType} />;
      case NodeTypeEnum.Sticker:
        return <StickerEditor currentNode={currentNode as StickerNodeType} />;
      default:
        return (
          <div style={{ padding: 12, color: "#999" }}>
            不支持的节点类型: {currentNode.type}
          </div>
        );
    }
  }, [currentNode]);

  // 只在 inline 模式下渲染
  if (fieldPanelMode !== "inline") {
    return null;
  }

  // 没有选中节点时不渲染
  if (!currentNode) {
    return null;
  }

  // Group 节点不需要内联编辑面板
  if (currentNode.type === NodeTypeEnum.Group) {
    return null;
  }

  // 拖动节点时隐藏面板
  if (isDragging) {
    return null;
  }

  // 加载遮罩
  const loadingOverlay = isLoading && (
    <div className={inlineStyle.loadingOverlay}>
      <Spin size="large" />
      <div className={inlineStyle.loadingText}>{progressStage}</div>
      {progressDetail && (
        <div className={inlineStyle.loadingDetail}>{progressDetail}</div>
      )}
    </div>
  );

  return (
    <ViewportPortal>
      <div
        className={classNames(
          "panel-base",
          "panel-show",
          inlineStyle.inlinePanel,
          fieldStyle.panel
        )}
        style={{
          position: "absolute",
          transform: `translate(${panelPosition.x}px, ${panelPosition.y}px) scale(${panelScale})`,
          width: PANEL_WIDTH,
        }}
        // 阻止事件冒泡到画布，但不阻止内部交互
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* 面板头部 */}
        <div className="header">
          <div className="header-left">
            <FieldPanelToolbarLeft currentNode={currentNode} />
          </div>
          <div className="header-center">
            <div className="title">节点字段</div>
          </div>
          <div className="header-right">
            <FieldPanelToolbarRight
              currentNode={currentNode}
              onLoadingChange={setIsLoading}
              onProgressChange={handleProgressChange}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {/* 面板内容 */}
        <div className={inlineStyle.content}>
          {loadingOverlay}
          {renderEditor}
        </div>
      </div>
    </ViewportPortal>
  );
}

export default memo(InlineFieldPanel);
