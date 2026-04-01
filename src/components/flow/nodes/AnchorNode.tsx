import { memo, useMemo, useState, useCallback } from "react";
import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";
import { Popover, Empty, message } from "antd";
import { ExportOutlined } from "@ant-design/icons";

import style from "../../../styles/flow/nodes.module.less";
import type { AnchorNodeDataType, NodeType } from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import { useConfigStore } from "../../../stores/configStore";
import { NodeTypeEnum } from "./constants";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { AnchorNodeHandles } from "./components/NodeHandles";
import { crossFileService } from "../../../services/crossFileService";

/**引用节点信息类型 */
interface ReferenceNodeInfo {
  id: string;
  label: string;
  /** 文件路径（跨文件时显示） */
  filePath?: string;
  /** 相对路径（用于显示） */
  relativePath?: string;
  /** 是否是当前文件 */
  isCurrentFile: boolean;
}

/**重定向节点内容 */
const ANodeContent = memo(
  ({
    data,
    referenceNodes,
    onNavigateToNode,
  }: {
    data: AnchorNodeDataType;
    referenceNodes?: ReferenceNodeInfo[];
    onNavigateToNode?: (node: ReferenceNodeInfo) => void;
  }) => {
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleNavigate = useCallback(
      (node: ReferenceNodeInfo) => {
        onNavigateToNode?.(node);
        setPopoverOpen(false);
      },
      [onNavigateToNode],
    );

    return (
      <>
        <div className={style.title}>
          <span className={style["title-text"]}>{data.label}</span>
          {referenceNodes && referenceNodes.length > 0 && (
            <Popover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              trigger="click"
              placement="right"
              title={`引用此锚点的节点 (${referenceNodes.length})`}
              content={
                <div className={style["anchor-ref-list"]}>
                  {referenceNodes.length === 0 ? (
                    <Empty
                      description="暂无引用"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    referenceNodes.map((node) => (
                      <div
                        key={node.id}
                        className={style["anchor-ref-item"]}
                        onClick={() => handleNavigate(node)}
                      >
                        <div className={style["anchor-ref-node-info"]}>
                          <span className={style["anchor-ref-label"]}>
                            {node.label}
                          </span>
                          {!node.isCurrentFile && node.relativePath && (
                            <span className={style["anchor-ref-file"]}>
                              {node.relativePath}
                            </span>
                          )}
                        </div>
                        <ExportOutlined className={style["anchor-ref-icon"]} />
                      </div>
                    ))
                  )}
                </div>
              }
            >
              <div
                className={style["navigate-btn"]}
                title={`${referenceNodes.length} 个节点引用此锚点`}
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
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
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
  const nodes = useFlowStore((state) => state.nodes);
  const instance = useFlowStore((state) => state.instance);
  const getNodesUsingAnchor = useFlowStore(
    (state) => state.getNodesUsingAnchor,
  );

  // 获取引用此 anchor 的节点列表（支持跨文件）
  const referenceNodes = useMemo((): ReferenceNodeInfo[] => {
    const result: ReferenceNodeInfo[] = [];

    // 1. 当前文件中的引用节点（从索引获取）
    const currentNodeIds = getNodesUsingAnchor(props.data.label);
    for (const id of currentNodeIds) {
      const node = nodes.find((n: NodeType) => n.id === id);
      if (node) {
        result.push({
          id: node.id,
          label: node.data.label,
          isCurrentFile: true,
        });
      }
    }

    // 2. 跨文件搜索引用该 anchor 的节点
    const crossFileRefs = crossFileService.getAnchorReferencesCrossFile(
      props.data.label,
    );
    for (const ref of crossFileRefs) {
      result.push({
        id: ref.id,
        label: ref.label,
        filePath: ref.filePath,
        relativePath: ref.relativePath,
        isCurrentFile: false,
      });
    }

    return result;
  }, [props.data.label, nodes, getNodesUsingAnchor]);

  // 跳转到指定节点
  const handleNavigateToNode = useCallback(
    async (node: ReferenceNodeInfo) => {
      if (node.isCurrentFile) {
        // 当前文件内跳转
        if (!instance) return;

        const targetNode = nodes.find((n: NodeType) => n.id === node.id);
        if (!targetNode) return;

        // 取消所有选中，选中目标节点
        useFlowStore.getState().updateNodes(
          nodes.map((n: NodeType) => ({
            type: "select" as const,
            id: n.id,
            selected: n.id === node.id,
          })),
        );

        // 聚焦到目标节点
        const { x, y } = targetNode.position;
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
    [instance, nodes],
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
