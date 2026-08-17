import { memo, useMemo, useState, useCallback } from "react";
import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";
import { Popover, message } from "antd";
import { ExportOutlined } from "@ant-design/icons";

import style from "../../../styles/flow/nodes.module.less";
import type { AnchorNodeDataType, NodeType } from "../../../stores/flow";
import { useFlowStore, getNodeAbsolutePosition } from "../../../stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "./constants";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { AnchorNodeHandles } from "./components/NodeHandles";
import { crossFileService } from "../../../services/crossFileService";
import { isEmbedEnvironment } from "../../../utils/embedBridge";
import { useEmbedStore } from "../../../stores/embed/embedStore";
import { AnchorReferenceList } from "./AnchorReferenceList";
import {
  resolveAnchorReferences,
  type AnchorReferenceNodeInfo,
} from "./anchorReferences";

/**重定向节点内容 */
const ANodeContent = memo(
  ({
    data,
    referenceNodes,
    onNavigateToNode,
    canNavigateReferences,
    replicaCount,
  }: {
    data: AnchorNodeDataType;
    referenceNodes?: AnchorReferenceNodeInfo[];
    onNavigateToNode?: (node: AnchorReferenceNodeInfo) => void;
    canNavigateReferences: boolean;
    replicaCount: number;
  }) => {
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleNavigate = useCallback(
      (node: AnchorReferenceNodeInfo) => {
        onNavigateToNode?.(node);
        setPopoverOpen(false);
      },
      [onNavigateToNode],
    );

    return (
      <>
        <div className={style.title}>
          <span className={style["title-text"]}>{data.label}</span>
          {replicaCount > 0 && (
            <span
              className={style["replica-badge"]}
              title={`此重定向节点共有 ${replicaCount + 1} 个视觉副本`}
            >
              +{replicaCount}
            </span>
          )}
          {referenceNodes && referenceNodes.length > 0 && (
            <Popover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              trigger="click"
              placement="right"
              title={`定义此 Anchor 的节点 (${referenceNodes.length})`}
              content={
                <AnchorReferenceList
                  referenceNodes={referenceNodes}
                  canNavigate={canNavigateReferences}
                  onNavigate={handleNavigate}
                />
              }
            >
              <div
                className={style["navigate-btn"]}
                title={`${referenceNodes.length} 个节点定义了此 Anchor`}
              >
                <ExportOutlined />
              </div>
            </Popover>
          )}
        </div>
        <AnchorNodeHandles direction={data.handleDirection} />
      </>
    );
  },
);

type AnchorNodeData = Node<AnchorNodeDataType, NodeTypeEnum.Anchor>;

/**重定向节点组件 */
export function AnchorNode(props: NodeProps<AnchorNodeData>) {
  const isEmbed = isEmbedEnvironment();
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const anchorDefinitions = useEmbedStore((state) => state.anchorDefinitions);
  const currentFileName = useEmbedStore((state) => state.currentFileName);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<AnchorNodeDataType, NodeTypeEnum.Anchor>
    | undefined;

  // 获取选中状态、边信息和路径状态
  const { selectedNodes, selectedEdges, pathMode, pathNodeIds } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathNodeIds: state.pathNodeIds,
    })),
  );
  const edges = useFlowStore((state) => state.edges);
  const instance = useFlowStore((state) => state.instance);
  const referencedNodeIds = useFlowStore((state) =>
    state.anchorReferenceIndex.get(props.data.label),
  );
  const referencedNodes = useFlowStore(
    useShallow((state) =>
      state.nodes.filter((node) => referencedNodeIds?.has(node.id)),
    ),
  );

  // 视觉副本数量（同 label 的其他 Anchor 节点）
  const replicaCount = useFlowStore((state) => {
    let count = 0;
    for (const node of state.nodes) {
      if (
        node.type === NodeTypeEnum.Anchor &&
        node.id !== props.id &&
        node.data.label === props.data.label
      ) {
        count++;
      }
    }
    return count;
  });

  // 获取引用此 anchor 的节点列表（支持跨文件）
  const referenceNodes = useMemo((): AnchorReferenceNodeInfo[] => {
    const currentReferences = referencedNodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      isCurrentFile: true,
    }));

    return resolveAnchorReferences({
      anchorName: props.data.label,
      currentFileName,
      currentReferences,
      isEmbed,
      anchorDefinitions,
      getCrossFileReferences: (anchorName) =>
        crossFileService.getAnchorReferencesCrossFile(anchorName),
    });
  }, [
    anchorDefinitions,
    currentFileName,
    isEmbed,
    props.data.label,
    referencedNodes,
  ]);

  // 跳转到指定节点
  const handleNavigateToNode = useCallback(
    async (node: AnchorReferenceNodeInfo) => {
      if (isEmbed) return;
      if (node.isCurrentFile) {
        // 当前文件内跳转
        if (!instance) return;

        const currentNodes = useFlowStore.getState().nodes;
        const targetNode = currentNodes.find((n: NodeType) => n.id === node.id);
        if (!targetNode) return;

        // 取消所有选中，选中目标节点
        useFlowStore.getState().updateNodes(
          currentNodes.map((n: NodeType) => ({
            type: "select" as const,
            id: n.id,
            selected: n.id === node.id,
          })),
        );

        // 聚焦到目标节点
        const { x, y } = getNodeAbsolutePosition(targetNode, currentNodes);
        const { width = 200, height = 100 } = targetNode.measured || {};
        instance.setCenter(x + width / 2, y + height / 2, {
          duration: 500,
          zoom: 1.5,
        });
      } else if (node.filePath) {
        // 跨文件跳转（支持前端多 tab 场景）
        const success = await crossFileService.navigateToNodeByFileAndLabel(
          node.filePath,
          node.label,
        );

        if (success) {
          message.success(
            `已跳转到 ${node.relativePath || node.filePath} 并定位节点: ${node.label}`,
          );
        } else {
          message.warning(`跳转失败: ${node.label}`);
        }
      }
    },
    [instance, isEmbed],
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    if (focusOpacity === 1 || props.selected) return true;

    // 路径模式
    if (pathMode && pathNodeIds.size > 0) {
      return pathNodeIds.has(props.id);
    }

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
    if (
      thisNode &&
      (thisNode as any).parentId &&
      selectedNodeIds.has((thisNode as any).parentId)
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
    props.id,
    selectedNodes,
    selectedEdges,
    edges,
  ]);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["anchor-node"]]: true,
        [style["node-selected"]]: props.selected,
      }),
    [props.selected],
  );

  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  if (!node) {
    return (
      <div className={nodeClass} style={opacityStyle}>
        <ANodeContent
          data={props.data}
          referenceNodes={referenceNodes}
          onNavigateToNode={handleNavigateToNode}
          canNavigateReferences={!isEmbed}
          replicaCount={replicaCount}
        />
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
        <ANodeContent
          data={props.data}
          referenceNodes={referenceNodes}
          onNavigateToNode={handleNavigateToNode}
          canNavigateReferences={!isEmbed}
          replicaCount={replicaCount}
        />
      </div>
    </NodeContextMenu>
  );
}

export const AnchorNodeMemo = memo(AnchorNode, (prev, next) => {
  // 基础属性比较
  if (
    prev.id !== next.id ||
    prev.selected !== next.selected ||
    prev.dragging !== next.dragging
  ) {
    return false;
  }

  // data 字段比较
  if (
    prev.data.label !== next.data.label ||
    prev.data.handleDirection !== next.data.handleDirection
  ) {
    return false;
  }

  return true;
});
