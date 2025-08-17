import style from "../styles/Flow.module.less";
import "@xyflow/react/dist/style.css";

import { useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useOnViewportChange,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
} from "@xyflow/react";

import { useFlowStore } from "../stores/flowStore";
import { nodeTypes } from "./flow/nodes";
import { edgeTypes } from "./flow/edges";
import { flowToPipeline } from "../core/parser";

/**工作流 */
// 工作流监视器
function InstanceMonitor() {
  const updateInstance = useFlowStore((state) => state.updateInstance);
  const instance = useReactFlow();
  useEffect(() => {
    updateInstance(instance);
  }, [instance, updateInstance]);
  return null;
}
// 视口监视器
function ViewportChangeMonitor() {
  const updateViewport = useFlowStore((state) => state.updateViewport);
  useOnViewportChange({
    onEnd: (viewport: Viewport) => {
      updateViewport(viewport);
    },
  });
  return null;
}

let transTimeout: number | null = null;
function MainFlow() {
  // store
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const updateNodes = useFlowStore((state) => state.updateNodes);
  const updateEdges = useFlowStore((state) => state.updateEdges);
  const addEdge = useFlowStore((state) => state.addEdge);
  const updateSize = useFlowStore((state) => state.updateSize);

  // 回调
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => updateNodes(changes),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => updateEdges(changes),
    []
  );
  const onConnect = useCallback((co: Connection) => addEdge(co), []);

  // hook
  const ref = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const { width, height } = e.contentRect;
        updateSize(width, height);
      });
    });
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  });

  // 监听响应
  if (transTimeout) clearTimeout(transTimeout);
  transTimeout = setTimeout(() => {
    flowToPipeline();
  }, 200);

  // 渲染
  return (
    <div className={style.editor} ref={ref}>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edgeTypes={edgeTypes}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
      >
        <Background />
        <Controls />
        <InstanceMonitor />
        <ViewportChangeMonitor />
      </ReactFlow>
    </div>
  );
}

export default MainFlow;
