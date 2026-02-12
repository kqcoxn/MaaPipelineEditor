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
import { Dropdown } from "antd";

import { useFlowStore, type EdgeType, type NodeType } from "../stores/flow";
import { useShallow } from "zustand/shallow";
import { useClipboardStore } from "../stores/clipboardStore";
import { nodeTypes } from "./flow/nodes";
import { NodeTypeEnum } from "./flow/nodes/constants";
import { edgeTypes } from "./flow/edges";
import { localSave, useFileStore } from "../stores/fileStore";
import NodeAddPanel from "./panels/main/NodeAddPanel";
import InlineFieldPanel from "./panels/main/InlineFieldPanel";
import InlineEdgePanel from "./panels/main/InlineEdgePanel";
import { useConfigStore } from "../stores/configStore";
import SnapGuidelines from "./flow/SnapGuidelines";
import {
  findSnapAlignment,
  type SnapGuideline,
} from "../core/snapUtils";

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
    groupSelectedNodes,
    attachNodeToGroup,
    detachNodeFromGroup,
  } = useFlowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      updateNodes: state.updateNodes,
      updateEdges: state.updateEdges,
      addEdge: state.addEdge,
      updateSize: state.updateSize,
      updateSelection: state.updateSelection,
      groupSelectedNodes: state.groupSelectedNodes,
      attachNodeToGroup: state.attachNodeToGroup,
      detachNodeFromGroup: state.detachNodeFromGroup,
    }))
  );
  const canvasBackgroundMode = useConfigStore(
    (state) => state.configs.canvasBackgroundMode
  );
  const enableNodeSnap = useConfigStore(
    (state) => state.configs.enableNodeSnap
  );
  const selfElem = useRef<HTMLDivElement>(null);

  // 节点添加面板状态
  const [nodeAddPanelVisible, setNodeAddPanelVisible] = useState(false);
  const [nodeAddPanelPos, setNodeAddPanelPos] = useState({ x: 0, y: 0 });

  // 磁吸对齐参考线
  const [snapGuidelines, setSnapGuidelines] = useState<SnapGuideline[]>([]);

  // 选区右键菜单
  const [selectionMenuPos, setSelectionMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

  // 节点拖拽磁吸对齐
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: NodeType) => {
      if (!enableNodeSnap) return;
      const otherNodes = nodes.filter(
        (n) => n.id !== draggedNode.id && n.type !== NodeTypeEnum.Group
      );
      if (otherNodes.length === 0) {
        setSnapGuidelines([]);
        return;
      }
      const result = findSnapAlignment(draggedNode, otherNodes);
      setSnapGuidelines(result.guidelines);

      const dx = result.position.x - draggedNode.position.x;
      const dy = result.position.y - draggedNode.position.y;
      if (dx !== 0 || dy !== 0) {
        updateNodes([
          {
            type: "position",
            id: draggedNode.id,
            position: result.position,
            dragging: true,
          },
        ]);
      }
    },
    [enableNodeSnap, nodes, updateNodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: NodeType) => {
      setSnapGuidelines([]);

      // 磁吸对齐
      if (enableNodeSnap) {
        const otherNodes = nodes.filter(
          (n) => n.id !== draggedNode.id && n.type !== NodeTypeEnum.Group
        );
        if (otherNodes.length > 0) {
          const result = findSnapAlignment(draggedNode, otherNodes);
          const dx = result.position.x - draggedNode.position.x;
          const dy = result.position.y - draggedNode.position.y;
          if (dx !== 0 || dy !== 0) {
            updateNodes([
              {
                type: "position",
                id: draggedNode.id,
                position: result.position,
              },
            ]);
          }
        }
      }

      // 拖入/拖出分组检测
      if (draggedNode.type === NodeTypeEnum.Group) return;
      const currentNodes = useFlowStore.getState().nodes;
      // 获取最新的节点数据
      const currentDraggedNode = currentNodes.find((n) => n.id === draggedNode.id);
      if (!currentDraggedNode) return;
      
      const hasParent = !!(currentDraggedNode as any).parentId;

      if (hasParent) {
        // 检测是否拖出了父 Group 的范围
        const parentId = (currentDraggedNode as any).parentId;
        const parentNode = currentNodes.find((n) => n.id === parentId);
        if (parentNode) {
          // 优先使用测量尺寸
          const pw = parentNode.measured?.width ?? (parentNode as any).style?.width ?? 400;
          const ph = parentNode.measured?.height ?? (parentNode as any).style?.height ?? 300;
          const nx = currentDraggedNode.position.x;  
          const ny = currentDraggedNode.position.y;  
          const nw = currentDraggedNode.measured?.width ?? 200;
          const nh = currentDraggedNode.measured?.height ?? 100;
          
          // 如果节点中心在 parent 外部则脱离
          const cx = nx + nw / 2;
          const cy = ny + nh / 2;
          
          if (cx < 0 || cy < 0 || cx > pw || cy > ph) {
            detachNodeFromGroup(currentDraggedNode.id);
          }
        }
      } else {
        const rfInstance = useFlowStore.getState().instance;
        if (rfInstance) {
          const intersecting = rfInstance.getIntersectingNodes(currentDraggedNode as any);
          const groupHit = intersecting.find(
            (n: any) => n.type === NodeTypeEnum.Group
          );
          if (groupHit) {
            attachNodeToGroup(currentDraggedNode.id, groupHit.id);
          }
        }
      }
    },
    [enableNodeSnap, nodes, updateNodes, attachNodeToGroup, detachNodeFromGroup]
  );

  // 选区右键菜单
  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setSelectionMenuPos({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const handleCreateGroup = useCallback(() => {
    groupSelectedNodes();
    setSelectionMenuPos(null);
  }, [groupSelectedNodes]);

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
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
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
        <SnapGuidelines guidelines={snapGuidelines} />
      </ReactFlow>
      {/* 选区右键菜单 */}
      <Dropdown
        open={!!selectionMenuPos}
        onOpenChange={(open) => {
          if (!open) setSelectionMenuPos(null);
        }}
        menu={{
          items: [
            {
              key: "create-group",
              label: "创建分组",
              onClick: handleCreateGroup,
            },
          ],
        }}
        trigger={["contextMenu"]}
      >
        {selectionMenuPos ? (
          <div
            style={{
              position: "fixed",
              left: selectionMenuPos.x,
              top: selectionMenuPos.y,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
        ) : (
          <span />
        )}
      </Dropdown>
    </div>
  );
}

export default MainFlow;
