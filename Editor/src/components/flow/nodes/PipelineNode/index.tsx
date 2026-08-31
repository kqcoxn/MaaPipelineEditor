import { memo, useMemo, useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import classNames from "classnames";
import style from "../../../../styles/flow/nodes.module.less";
import type { PipelineNodeDataType } from "../../../../stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { NodeTypeEnum } from "../constants";
import { ModernContent } from "./ModernContent";
import { ClassicContent } from "./ClassicContent";
import { MinimalContent } from "./MinimalContent";
import { useShallow } from "zustand/shallow";
import { NodeContextMenu } from "../components/NodeContextMenu";
import { useDebugOverlayStore } from "@/stores/debug/debugOverlayStore";
import { useNodeFocusState } from "../../focusSelectors";

type PNodeData = Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>;
/**Pipeline节点组件 */
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
    | undefined;

  const debugOverlay = useDebugOverlayStore(
    useShallow((state) => ({
      currentNodeId: state.currentNodeId,
      activeRecognitionNodeIds: state.activeRecognitionNodeIds,
    })),
  );

  const { isRelated, isAnchorRefHighlighted } = useNodeFocusState({
    nodeId: props.id,
    selected: props.selected,
    focusOpacity,
    includeAnchorReference: true,
  });

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
        [style["debug-node-current"]]: debugOverlay.currentNodeId === props.id,
        [style["debug-node-recognizing"]]:
          debugOverlay.activeRecognitionNodeIds.has(props.id),
      }),
    [
      props.selected,
      nodeStyle,
      isAnchorRefHighlighted,
      debugOverlay.currentNodeId,
      debugOverlay.activeRecognitionNodeIds,
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

  if (!node) {
    return (
      <div className={nodeClass} style={opacityStyle}>
        {renderContent()}
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
      </div>
    </NodeContextMenu>
  );
}

export const PipelineNodeMemo = memo(PipelineNode);
