import { memo, useMemo, useState, useCallback } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import classNames from "classnames";
import { useShallow } from "zustand/shallow";
import { Popover, message } from "antd";
import { ExportOutlined } from "@ant-design/icons";

import style from "../../../styles/flow/nodes.module.less";
import type { AnchorNodeDataType } from "../../../stores/flow";
import {
  useFlowStore,
  getNodeTypeLabelKey,
} from "../../../stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "./constants";
import { AnchorNodeHandles } from "./components/NodeHandles";
import { crossFileService } from "../../../services/crossFileService";
import { isEmbedEnvironment } from "../../../utils/embedBridge";
import { useEmbedStore } from "../../../stores/embed/embedStore";
import { AnchorReferenceList } from "./AnchorReferenceList";
import {
  resolveAnchorReferences,
  type AnchorReferenceNodeInfo,
} from "./anchorReferences";
import { useNodeFocusState } from "../focusSelectors";
import { selectAndCenterNode } from "../../../services/flowNavigationService";

const EMPTY_NODE_IDS = new Set<string>();

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
  const referencedNodes = useFlowStore(
    useShallow((state) => {
      const referencedNodeIds =
        state.anchorReferenceIndex.get(props.data.label) ?? EMPTY_NODE_IDS;
      return Array.from(referencedNodeIds)
        .map((nodeId) => state.nodeSemanticById.get(nodeId))
        .filter((node) => node !== undefined);
    }),
  );

  // 视觉副本数量（同 label 的其他 Anchor 节点）
  const replicaCount = useFlowStore((state) =>
    Math.max(
      0,
      (state.nodeIdsByTypeAndLabel.get(
        getNodeTypeLabelKey(NodeTypeEnum.Anchor, props.data.label),
      )?.size ?? 0) - 1,
    ),
  );

  // 获取引用此 anchor 的节点列表（支持跨文件）
  const referenceNodes = useMemo((): AnchorReferenceNodeInfo[] => {
    const currentReferences = referencedNodes.map((node) => ({
      id: node.id,
      label: node.label,
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
        selectAndCenterNode(node.id);
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
    [isEmbed],
  );

  const { isRelated } = useNodeFocusState({
    nodeId: props.id,
    selected: props.selected,
    focusOpacity,
  });

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
