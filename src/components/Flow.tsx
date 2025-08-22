import style from "../styles/Flow.module.less";
import "@xyflow/react/dist/style.css";

import { useCallback, useRef, useEffect, useMemo, memo } from "react";
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
  useKeyPress,
} from "@xyflow/react";

import { useFlowStore, type NodeType } from "../stores/flowStore";
import { nodeTypes } from "./flow/nodes";
import { edgeTypes } from "./flow/edges";

/**工作流 */
// 实例监视器
const InstanceMonitor = memo(() => {
  const updateInstance = useFlowStore((state) => state.updateInstance);
  const instance = useReactFlow();
  useEffect(() => {
    updateInstance(instance);
  }, [instance, updateInstance]);
  return null;
});
// 视口监视器
const ViewportChangeMonitor = memo(() => {
  const updateViewport = useFlowStore((state) => state.updateViewport);
  useOnViewportChange({
    onEnd: (viewport: Viewport) => {
      updateViewport(viewport);
    },
  });
  return null;
});
// 按键监听
const KeyListener = memo(() => {
  // 删除节点
  const deletePressed = useKeyPress("Delete");
  const selectedNodes = useFlowStore(
    (state) => state.selectedNodes
  ) as NodeType[];
  const updateNodes = useFlowStore((state) => state.updateNodes);
  useEffect(() => {
    if (!deletePressed) return;
    if (selectedNodes.length === 0) return;
    updateNodes(
      selectedNodes.map((node) => ({
        id: node.id,
        type: "remove",
      }))
    );
  }, [deletePressed, selectedNodes]);

  return null;
});

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

  // 记忆
  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 1.5 }), []);

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
        defaultViewport={defaultViewport}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background />
        <Controls orientation={"horizontal"} />
        <InstanceMonitor />
        <ViewportChangeMonitor />
        <KeyListener />
      </ReactFlow>
    </div>
  );
}

export default MainFlow;
