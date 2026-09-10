import { useMemo, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { useStore, type ReactFlowState } from "@xyflow/react";

const selectCanvasRoot = (state: ReactFlowState) => state.domNode;

/**
 * 标签容器由 React Flow 与画布一起挂载，生命周期随 domNode 变化。
 * 只订阅根元素，避免上游 EdgeLabelRenderer 在每次视口更新时逐边查询 DOM。
 * 保留原生标签层及其平移、缩放、层级和事件行为。
 */
export function StableEdgeLabelRenderer({ children }: PropsWithChildren) {
  const root = useStore(selectCanvasRoot);
  const container = useMemo(
    () => root?.querySelector(".react-flow__edgelabel-renderer"),
    [root],
  );

  return container ? createPortal(children, container) : null;
}
