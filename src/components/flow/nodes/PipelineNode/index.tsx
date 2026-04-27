import { memo, useMemo, useState, useCallback } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import classNames from "classnames";
import { Button, message } from "antd";
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import style from "../../../../styles/flow/nodes.module.less";
import explorationStyle from "../../../../styles/panels/ExplorationPanel.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useFlowStore } from "../../../../stores/flow";
import { useConfigStore } from "../../../../stores/configStore";
import { NodeTypeEnum } from "../constants";
import { ModernContent } from "./ModernContent";
import { ClassicContent } from "./ClassicContent";
import { MinimalContent } from "./MinimalContent";
import { useShallow } from "zustand/shallow";
import { NodeContextMenu } from "../components/NodeContextMenu";
import { useDebugOverlayStore } from "../../../../stores/debugOverlayStore";

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;
type ParentNodeRef = { parentId?: string };

/**Pipeline节点组件 */
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 探索模式状态和操作
  const status = useFlowStore((state) => state.status);
  const ghostNodeId = useFlowStore((state) => state.ghostNodeId);
  const execute = useFlowStore((state) => state.execute);
  const confirm = useFlowStore((state) => state.confirm);
  const regenerate = useFlowStore((state) => state.regenerate);

  // 判断当前节点是否为活跃的 Ghost Node
  // 通过 ghostNodeId 判断
  const isActiveGhostNode = ghostNodeId === props.id && status === "reviewing";

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
    | undefined;

  // 获取选中状态、边信息和路径状态
  const {
    selectedNodes,
    selectedEdges,
    pathMode,
    pathNodeIds,
    anchorRefHighlightedNodeIds,
  } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathNodeIds: state.pathNodeIds,
      anchorRefHighlightedNodeIds: state.anchorRefHighlightedNodeIds,
    })),
  );
  const edges = useFlowStore((state) => state.edges);
  const debugOverlay = useDebugOverlayStore(
    useShallow((state) => ({
      currentNodeId: state.currentNodeId,
      visitedNodeIds: state.visitedNodeIds,
      succeededNodeIds: state.succeededNodeIds,
      failedNodeIds: state.failedNodeIds,
    })),
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    // 透明度为1或当前节点被选中
    if (focusOpacity === 1 || props.selected) return true;

    // 路径模式
    if (pathMode && pathNodeIds.size > 0) {
      return pathNodeIds.has(props.id);
    }

    // Anchor 引用高亮模式高亮的节点也视为相关
    if (
      anchorRefHighlightedNodeIds.size > 0 &&
      anchorRefHighlightedNodeIds.has(props.id)
    ) {
      return true;
    }

    // 没有选中任何内容
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;

    const nodeId = props.id;
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // 检查是否有便签节点被选中
    const hasStickerSelected = selectedNodes.some(
      (node) => node.type === NodeTypeEnum.Sticker,
    );

    // 如果选中的是便签节点，则不产生聚焦效果
    if (hasStickerSelected) return true;

    // 检查分组关系
    const thisNode = useFlowStore.getState().nodes.find((n) => n.id === nodeId);
    const parentId = (thisNode as ParentNodeRef | undefined)?.parentId;
    if (
      parentId &&
      selectedNodeIds.has(parentId)
    ) {
      return true;
    }

    // 检查是否与选中的边相连
    for (const selectedEdge of selectedEdges) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) {
        return true;
      }
    }

    // 仅在有选中节点时检查节点连接关系
    if (selectedNodes.length > 0) {
      // 只检查与当前节点相关的边
      for (const edge of edges) {
        if (edge.target === nodeId && selectedNodeIds.has(edge.source)) {
          return true;
        }
        if (edge.source === nodeId && selectedNodeIds.has(edge.target)) {
          return true;
        }
      }
    }

    return false;
  }, [
    focusOpacity,
    props.selected,
    pathMode,
    pathNodeIds,
    anchorRefHighlightedNodeIds,
    props.id,
    selectedNodes,
    selectedEdges,
    edges,
  ]);

  // 计算 anchor 引用高亮状态
  const isAnchorRefHighlighted = useMemo(() => {
    return anchorRefHighlightedNodeIds.has(props.id);
  }, [anchorRefHighlightedNodeIds, props.id]);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: props.selected,
        [style["modern-node"]]: nodeStyle === "modern",
        [style["minimal-node"]]: nodeStyle === "minimal",
        // Anchor 引用高亮样式
        [style["anchor-ref-highlighted"]]: isAnchorRefHighlighted,
        // Ghost Node 样式
        [explorationStyle.ghostNode]: isActiveGhostNode,
        [style["debug-node-current"]]: debugOverlay.currentNodeId === props.id,
        [style["debug-node-visited"]]: debugOverlay.visitedNodeIds.has(props.id),
        [style["debug-node-succeeded"]]:
          debugOverlay.succeededNodeIds.has(props.id),
        [style["debug-node-failed"]]: debugOverlay.failedNodeIds.has(props.id),
      }),
    [
      props.selected,
      nodeStyle,
      isAnchorRefHighlighted,
      isActiveGhostNode,
      debugOverlay.currentNodeId,
      debugOverlay.visitedNodeIds,
      debugOverlay.succeededNodeIds,
      debugOverlay.failedNodeIds,
      props.id,
    ],
  );

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  // 渲染内容组件
  const renderContent = () => {
    switch (nodeStyle) {
      case "minimal":
        return <MinimalContent data={props.data} props={props} />;
      case "modern":
        return <ModernContent data={props.data} props={props} />;
      default:
        return <ClassicContent data={props.data} props={props} />;
    }
  };

  // 处理确认操作
  const handleConfirm = useCallback(async () => {
    const success = await confirm();
    if (!success) {
      const error = useFlowStore.getState().error;
      if (error) {
        message.error(error);
      }
    }
  }, [confirm]);

  // 处理重新生成操作
  const handleRegenerate = useCallback(() => {
    regenerate();
  }, [regenerate]);

  if (!node) {
    return (
      <div className={nodeClass} style={opacityStyle}>
        {renderContent()}
        {isActiveGhostNode && (
          <div className={explorationStyle.ghostNodeActions}>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                execute();
              }}
            >
              执行
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
            >
              重新生成
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm();
              }}
            >
              确认
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <NodeContextMenu
      node={node}
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
    >
      <div className={nodeClass} style={opacityStyle}>
        {renderContent()}
        {isActiveGhostNode && (
          <div className={explorationStyle.ghostNodeActions}>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                execute();
              }}
            >
              执行
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
            >
              重新生成
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleConfirm();
              }}
            >
              确认
            </Button>
          </div>
        )}
      </div>
    </NodeContextMenu>
  );
}

export const PipelineNodeMemo = memo(PipelineNode, (prev, next) => {
  // 基础属性比较
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  // 比较 data
  const prevData = prev.data;
  const nextData = next.data;
  if (prevData.label !== nextData.label) {
    return false;
  }

  if (prevData.recognition.type !== nextData.recognition.type) {
    return false;
  }
  try {
    if (
      JSON.stringify(prevData.recognition.param) !==
      JSON.stringify(nextData.recognition.param)
    ) {
      return false;
    }
  } catch {
    if (prevData.recognition.param !== nextData.recognition.param) {
      return false;
    }
  }

  if (prevData.action.type !== nextData.action.type) {
    return false;
  }
  try {
    if (
      JSON.stringify(prevData.action.param) !==
      JSON.stringify(nextData.action.param)
    ) {
      return false;
    }
  } catch {
    if (prevData.action.param !== nextData.action.param) {
      return false;
    }
  }

  if (
    prevData.others !== nextData.others ||
    prevData.extras !== nextData.extras ||
    prevData.handleDirection !== nextData.handleDirection
  ) {
    return false;
  }

  return true;
});
