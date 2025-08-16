import style from "../styles/Editor.module.less";
import "@xyflow/react/dist/style.css";

import { useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";

import { useFlowStore } from "../stores/flowStore";
import { nodeTypes } from "./flow/nodes";

function Editor() {
  // store
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const updateNodes = useFlowStore((state) => state.updateNodes);
  const updateEdges = useFlowStore((state) => state.updateEdges);
  const addEdge = useFlowStore((state) => state.addEdge);

  // 回调
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => updateNodes(changes),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => updateEdges(changes),
    []
  );
  const onConnect = useCallback((params: any) => addEdge(params), []);

  // 渲染
  return (
    <div className={style.editor}>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default Editor;
