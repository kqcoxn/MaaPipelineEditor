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
  type OnSelectionChangeParams,
  useKeyPress,
} from "@xyflow/react";
import { useDebounceEffect } from "ahooks";

import {
  useFlowStore,
  type EdgeType,
  type NodeType,
} from "../stores/flow";
import { useConfigStore } from "../stores/configStore";
import { useClipboardStore } from "../stores/clipboardStore";
import { nodeTypes } from "./flow/nodes";
import { edgeTypes } from "./flow/edges";
import { localSave, useFileStore } from "../stores/fileStore";

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
    const copy = useClipboardStore((state) => state.copy);
    const clipboardNodes = useClipboardStore((state) => state.clipboardNodes);
    const paste = useClipboardStore((state) => state.paste);
    const flowPaste = useFlowStore((state) => state.paste);

    const keyPressOptions = useMemo(
      () => ({
        target: targetRef.current,
        actInsideInputWithModifier: false,
      }),
      [targetRef.current]
    );

    // 复制节点
    const copyPressed = useKeyPress("Control+c", keyPressOptions);
    useEffect(() => {
      if (!copyPressed || selectedNodes.length === 0) return;
      copy(selectedNodes, selectedEdges);
    }, [copyPressed]);

    // 粘贴节点
    const pastePressed = useKeyPress("Control+v", keyPressOptions);
    useEffect(() => {
      if (!pastePressed || clipboardNodes.length === 0) return;
      const content = paste();
      if (content) {
        flowPaste(content.nodes, content.edges);
      }
    }, [pastePressed, clipboardNodes]);

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
// 更新器
const UpdateMonitor = memo(() => {
  const debouncedSelectedNodes = useFlowStore((state) => state.debouncedSelectedNodes);
  const debouncedSelectedEdges = useFlowStore((state) => state.debouncedSelectedEdges);
  const debouncedTargetNode = useFlowStore((state) => state.debouncedTargetNode);
  const filesLength = useFileStore((state) => state.files.length);

  useDebounceEffect(
    () => {
      localSave();
    },
    [debouncedSelectedNodes, debouncedSelectedEdges, debouncedTargetNode, filesLength],
    {
      wait: 500,
    }
  );

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
  const updateSelection = useFlowStore((state) => state.updateSelection);
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
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      updateSelection(params.nodes as NodeType[], params.edges as EdgeType[]);
    },
    []
  );

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
        onSelectionChange={onSelectionChange}
        defaultViewport={defaultViewport}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background />
        <Controls orientation={"horizontal"} />
        <InstanceMonitor />
        <ViewportChangeMonitor />
        <KeyListener targetRef={selfElem} />
        <UpdateMonitor />
      </ReactFlow>
    </div>
  );
}

export default MainFlow;
