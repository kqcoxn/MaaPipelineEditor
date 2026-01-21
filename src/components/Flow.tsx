import style from "../styles/Flow.module.less";
import "@xyflow/react/dist/style.css";

import {
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
  useState,
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
import { useDebounceEffect, useDebounceFn } from "ahooks";

import { useFlowStore, type EdgeType, type NodeType } from "../stores/flow";
import { useShallow } from "zustand/shallow";
import { useClipboardStore } from "../stores/clipboardStore";
import { nodeTypes } from "./flow/nodes";
import { edgeTypes } from "./flow/edges";
import { localSave, useFileStore } from "../stores/fileStore";
import NodeAddPanel from "./panels/main/NodeAddPanel";
import InlineFieldPanel from "./panels/main/InlineFieldPanel";
import InlineEdgePanel from "./panels/main/InlineEdgePanel";
import { useConfigStore } from "../stores/configStore";

/**工作流 */
// 按键监听
const KeyListener = memo(
  ({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) => {
    const { selectedNodes, selectedEdges } = useFlowStore(
      useShallow((state) => ({
        selectedNodes: state.selectedNodes,
        selectedEdges: state.selectedEdges,
      }))
    );
    const { copy, clipboardNodes, paste } = useClipboardStore(
      useShallow((state) => ({
        copy: state.copy,
        clipboardNodes: state.clipboardNodes,
        paste: state.paste,
      }))
    );
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
  const setFileConfig = useFileStore((state) => state.setFileConfig);
  useOnViewportChange({
    onEnd: (viewport: Viewport) => {
      updateViewport(viewport);
      // 保存视口位置到当前文件配置
      setFileConfig("savedViewport", { ...viewport });
    },
  });
  return null;
});
// 更新器
const UpdateMonitor = memo(() => {
  const {
    debouncedSelectedNodes,
    debouncedSelectedEdges,
    debouncedTargetNode,
  } = useFlowStore(
    useShallow((state) => ({
      debouncedSelectedNodes: state.debouncedSelectedNodes,
      debouncedSelectedEdges: state.debouncedSelectedEdges,
      debouncedTargetNode: state.debouncedTargetNode,
    }))
  );
  const filesLength = useFileStore((state) => state.files.length);

  useDebounceEffect(
    () => {
      localSave();
    },
    [
      debouncedSelectedNodes,
      debouncedSelectedEdges,
      debouncedTargetNode,
      filesLength,
    ],
    {
      wait: 500,
    }
  );

  return null;
});

// 节点添加面板控制器
interface NodeAddPanelControllerProps {
  visible: boolean;
  screenPos: { x: number; y: number };
  setVisible: (v: boolean) => void;
  setScreenPos: (pos: { x: number; y: number }) => void;
  onClose: () => void;
}
const NodeAddPanelController = memo(
  ({
    visible,
    screenPos,
    setVisible,
    setScreenPos,
    onClose,
  }: NodeAddPanelControllerProps) => {
    const { screenToFlowPosition } = useReactFlow();

    // 实时计算 flow 坐标
    const flowPos = useMemo(() => {
      if (!visible) return undefined;
      return screenToFlowPosition(screenPos);
    }, [visible, screenPos, screenToFlowPosition]);

    // 在新位置重新打开
    const handleReopen = useCallback(
      (newPos: { x: number; y: number }) => {
        setScreenPos(newPos);
      },
      [setScreenPos]
    );

    return (
      <NodeAddPanel
        visible={visible}
        position={screenPos}
        flowPosition={flowPos}
        onClose={onClose}
        onReopen={handleReopen}
      />
    );
  }
);

function MainFlow() {
  const {
    nodes,
    edges,
    updateNodes,
    updateEdges,
    addEdge,
    updateSize,
    updateSelection,
  } = useFlowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      updateNodes: state.updateNodes,
      updateEdges: state.updateEdges,
      addEdge: state.addEdge,
      updateSize: state.updateSize,
      updateSelection: state.updateSelection,
    }))
  );
  const canvasBackgroundMode = useConfigStore(
    (state) => state.configs.canvasBackgroundMode
  );
  const selfElem = useRef<HTMLDivElement>(null);

  // 节点添加面板状态
  const [nodeAddPanelVisible, setNodeAddPanelVisible] = useState(false);
  const [nodeAddPanelPos, setNodeAddPanelPos] = useState({ x: 0, y: 0 });

  // 回调
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => updateNodes(changes),
    [updateNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => updateEdges(changes),
    [updateEdges]
  );
  const onConnect = useCallback((co: Connection) => addEdge(co), [addEdge]);
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      updateSelection(params.nodes as NodeType[], params.edges as EdgeType[]);
    },
    [updateSelection]
  );

  // 双击空白区域打开节点添加面板
  const onPaneClick = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      // 单击关闭面板
      if (nodeAddPanelVisible) {
        setNodeAddPanelVisible(false);
      }
    },
    [nodeAddPanelVisible]
  );

  // 双击处理
  const onDoubleClick = useCallback((event: React.MouseEvent | MouseEvent) => {
    setNodeAddPanelPos({ x: event.clientX, y: event.clientY });
    setNodeAddPanelVisible(true);
  }, []);

  // 右键空白区域打开节点添加面板
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setNodeAddPanelPos({ x: event.clientX, y: event.clientY });
      setNodeAddPanelVisible(true);
    },
    []
  );

  // 关闭节点添加面板
  const closeNodeAddPanel = useCallback(() => {
    setNodeAddPanelVisible(false);
  }, []);

  // 记忆
  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 1.5 }), []);

  // 背景颜色
  const backgroundColor = useMemo(() => {
    return canvasBackgroundMode === "pure" ? "#ffffff" : "#f9fafd";
  }, [canvasBackgroundMode]);

  // hook
  const ref = useRef(null);
  const debouncedUpdateSize = useDebounceFn(
    (width: number, height: number) => updateSize(width, height),
    { wait: 300 }
  );

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const { width, height } = e.contentRect;
        debouncedUpdateSize.run(width, height);
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
        onPaneClick={onPaneClick}
        onDoubleClick={onDoubleClick}
        onPaneContextMenu={onPaneContextMenu}
        autoPanOnConnect={false}
        autoPanOnNodeDrag={false}
        preventScrolling={true}
        elevateNodesOnSelect={true}
      >
        <Background bgColor={backgroundColor} />
        <Controls orientation="vertical" />
        <InstanceMonitor />
        <ViewportChangeMonitor />
        <KeyListener targetRef={selfElem} />
        <UpdateMonitor />
        <NodeAddPanelController
          visible={nodeAddPanelVisible}
          screenPos={nodeAddPanelPos}
          setVisible={setNodeAddPanelVisible}
          setScreenPos={setNodeAddPanelPos}
          onClose={closeNodeAddPanel}
        />
        <InlineFieldPanel />
        <InlineEdgePanel />
      </ReactFlow>
    </div>
  );
}

export default MainFlow;
