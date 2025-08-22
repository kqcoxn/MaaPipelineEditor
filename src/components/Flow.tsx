import style from "../styles/Flow.module.less";
import "@xyflow/react/dist/style.css";

import {
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
  type RefObject,
} from "react";
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

import {
  useFlowStore,
  type EdgeType,
  type NodeType,
} from "../stores/flowStore";
import { useConfigStore } from "../stores/configStore";
import { nodeTypes } from "./flow/nodes";
import { edgeTypes } from "./flow/edges";

/**工作流 */
// 按键监听
const KeyListener = memo(
  ({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) => {
    // store
    const selectedNodes = useFlowStore(
      (state) => state.selectedNodes
    ) as NodeType[];
    const selectedEdges = useFlowStore(
      (state) => state.selectedEdges
    ) as EdgeType[];
    const updateNodes = useFlowStore((state) => state.updateNodes);
    const setClipBoard = useConfigStore((state) => state.setClipBoard);
    const clipBoard = useConfigStore((state) => state.clipBoard);
    const applyClipBoard = useConfigStore((state) => state.applyClipBoard);

    const keyPressOptions = useMemo(
      () => ({
        target: targetRef.current,
        actInsideInputWithModifier: false,
      }),
      [targetRef.current]
    );

    // 删除节点
    console.log(targetRef.current);
    const deletePressed = useKeyPress("Delete", keyPressOptions);
    useEffect(() => {
      if (!deletePressed || selectedNodes.length === 0) return;
      updateNodes(
        selectedNodes.map((node) => ({
          id: node.id,
          type: "remove",
        }))
      );
    }, [deletePressed]);

    // 复制节点
    const copyPressed = useKeyPress("Control+c", keyPressOptions);
    useEffect(() => {
      if (!copyPressed || selectedNodes.length === 0) return;
      setClipBoard(selectedNodes, selectedEdges);
    }, [copyPressed]);

    // 粘贴节点
    const pastePressed = useKeyPress("Control+v", keyPressOptions);
    useEffect(() => {
      if (!pastePressed || clipBoard.nodes.length === 0) return;
      applyClipBoard();
    }, [pastePressed, clipBoard]);

    return null;
  }
);
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

function MainFlow() {
  // store
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const updateNodes = useFlowStore((state) => state.updateNodes);
  const updateEdges = useFlowStore((state) => state.updateEdges);
  const addEdge = useFlowStore((state) => state.addEdge);
  const updateSize = useFlowStore((state) => state.updateSize);
  const selfElem = useRef<HTMLDivElement>(null);

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
        ref={selfElem}
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
        <KeyListener targetRef={selfElem} />
      </ReactFlow>
    </div>
  );
}

export default MainFlow;
