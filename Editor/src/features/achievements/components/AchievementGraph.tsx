import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, useStore, type Node, type NodeChange, type NodeProps } from "@xyflow/react";
import { achievementConnections, type AchievementItem } from "../presentation";
import { layoutAchievementGraph, type AchievementGraphLayout, type AchievementNodeSize } from "../graphLayout";
import { ACHIEVEMENT_CATEGORY_LABELS, type AchievementCategory } from "../types";
import { AchievementCard } from "./AchievementCard";
import style from "@/styles/achievements/AchievementWall.module.less";

type AchievementNode = Node<{ item: AchievementItem }, "achievement">;

const AchievementGraphNode = memo(function AchievementGraphNode({ data }: NodeProps<AchievementNode>) {
  return <>
    <Handle type="target" position={Position.Left} className={style.handle} />
    <AchievementCard item={data.item} graph />
    <Handle type="source" position={Position.Right} className={style.handle} />
  </>;
});
type RegionNode = Node<{ category: AchievementCategory }, "region">;
function AchievementRegionNode({ data }: NodeProps<RegionNode>) {
  return <div className={style.graphRegion}>
    <span>{ACHIEVEMENT_CATEGORY_LABELS[data.category]}</span>
  </div>;
}
const nodeTypes = { achievement: AchievementGraphNode, region: AchievementRegionNode };

function GraphLayout({ onLayout, layoutKey }: {
  onLayout: (layout: AchievementGraphLayout) => void;
  layoutKey: string;
}) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  // 只在尺寸变化时重排；平移、缩放和位置更新不会再次触发布局。
  const sizes = useStore((state) => JSON.stringify([...state.nodeLookup.values()].filter((node) => node.type === "achievement").map((node) => ({
    id: node.id, category: (node.data as AchievementNode["data"]).item.def.category, width: node.measured.width ?? 280, height: node.measured.height ?? 180,
  }))));
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    const nodes: AchievementNodeSize[] = JSON.parse(sizes);
    void layoutAchievementGraph(nodes, achievementConnections).then((positions) => {
      if (!cancelled) onLayout(positions);
    }).catch((error: unknown) => {
      console.error("[Achievement] 成就图布局失败:", error);
    });
    return () => { cancelled = true; };
  }, [initialized, sizes, onLayout]);
  useEffect(() => {
    if (!initialized || layoutKey === "{}") return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.12, minZoom: 0.1, maxZoom: 1, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, layoutKey, fitView, width, height]);
  return null;
}

function AchievementGraphContent({ items }: { items: AchievementItem[] }) {
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback((changes: NodeChange<AchievementNode | RegionNode>[]) => {
    setMeasurements((previous) => {
      let next = previous;
      for (const change of changes) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const size = change.dimensions;
        if (previous[change.id]?.width === size.width && previous[change.id]?.height === size.height) continue;
        if (next === previous) next = { ...previous };
        next[change.id] = size;
      }
      return next;
    });
  }, []);
  const [layout, setLayout] = useState<AchievementGraphLayout>({ positions: {}, regions: [] });
  const { positions } = layout;
  const regions = useMemo<RegionNode[]>(() => layout.regions.map((region) => ({
    id: `region:${region.category}`, type: "region", position: { x: region.x, y: region.y },
    data: { category: region.category }, measured: measurements[`region:${region.category}`], style: { width: region.width, height: region.height, pointerEvents: "none" },
    zIndex: -1, selectable: false, focusable: false,
  })), [layout.regions, measurements]);
  const nodes = useMemo<AchievementNode[]>(() => items.map((item, index) => ({
    id: item.key, type: "achievement", position: positions[item.key] ?? { x: index * 352, y: 0 },
    data: { item }, measured: measurements[item.key],
  })), [items, positions, measurements]);
  const edges = useMemo(() => {
    const keys = new Set(items.map((item) => item.key));
    return achievementConnections.filter(([source, target]) => keys.has(source) && keys.has(target)).map(([source, target]) => ({
      id: `${source}:${target}`, source, target, type: "smoothstep",
      selectable: false, focusable: false,
      style: { stroke: "var(--ant-color-text-quaternary, #bfbfbf)", strokeDasharray: "5 6", strokeWidth: 1.5 },
    }));
  }, [items]);
  return <div className={style.graph}>
    <ReactFlow<AchievementNode | RegionNode> nodes={[...regions, ...nodes]} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false}
      elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
      deleteKeyCode={null} minZoom={0.1} maxZoom={1.5} panOnScroll
      proOptions={{ hideAttribution: true }}>
      <Background gap={20} size={1} color="var(--ant-color-border-secondary, #e5e5e5)" />
      <Controls showInteractive={false} fitViewOptions={{ padding: 0.18, maxZoom: 1 }} />
      <GraphLayout onLayout={setLayout} layoutKey={JSON.stringify(positions)} />
    </ReactFlow>
    <div className={style.graphLegend}><i /> 主题联系 · 可独立解锁</div>
  </div>;
}

export function AchievementGraph(props: Parameters<typeof AchievementGraphContent>[0]) {
  return <ReactFlowProvider><AchievementGraphContent {...props} /></ReactFlowProvider>;
}
