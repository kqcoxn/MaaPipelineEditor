import style from "../styles/layout/Flow.module.less";
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
  type FinalConnectionState,
  type OnConnectStartParams,
  type Viewport,
  type OnSelectionChangeParams,
  useKeyPress,
} from "@xyflow/react";
import { useDebounceEffect, useDebounceFn } from "ahooks";

import { useFlowStore, type EdgeType, type NodeType } from "../stores/flow";
import { useShallow } from "zustand/shallow";
import { useClipboardStore } from "../stores/clipboardStore";
import { nodeTypes } from "./flow/nodes";
import { NodeTypeEnum } from "./flow/nodes/constants";
import { edgeTypes } from "./flow/edges";
import { SelectionContextMenu } from "./flow/components/SelectionContextMenu";
import { localSave, useFileStore } from "../stores/fileStore";
import NodeAddPanel, {
  type QuickCreateConnection,
} from "./panels/main/NodeAddPanel";
import InlineFieldPanel from "./panels/main/InlineFieldPanel";
import InlineEdgePanel from "./panels/main/InlineEdgePanel";
import { useConfigStore } from "../stores/configStore";
import SnapGuidelines from "./flow/SnapGuidelines";
import {
  findSnapAlignment,
  filterNodesInViewport,
  type SnapGuideline,
} from "../core/snapUtils";
import { useEmbedMode } from "../hooks/useEmbedMode";
import { sendToParent } from "../utils/embedBridge";
import { FlowReadOnlyContext } from "./flow/FlowInteractionContext";
import { setPipelineViewport } from "../features/pipeline-document/pipelineDocumentService";
import type { DocumentId } from "../features/project-session/types";
import {
  allowedReadOnlyEdgeChanges,
  allowedReadOnlyNodeChanges,
} from "./flow/flowReadOnlyGuards";

/**工作流 */
// 按键监听
const KeyListener = memo(
  ({
    targetRef,
    allowCopy,
    allowPaste,
  }: {
    targetRef: RefObject<HTMLDivElement | null>;
    allowCopy: boolean;
    allowPaste: boolean;
  }) => {
    const isTextEditorFocused = useCallback(() => {
      const target = document.activeElement;
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target.isContentEditable
      ) {
        return true;
      }
      return Boolean(
        target.closest('[contenteditable="true"]') ||
          target.closest(".monaco-editor"),
      );
    }, []);
    const { selectedNodes, selectedEdges } = useFlowStore(
      useShallow((state) => ({
        selectedNodes: state.selectedNodes,
        selectedEdges: state.selectedEdges,
      })),
    );
    const { copy, clipboardNodes, paste } = useClipboardStore(
      useShallow((state) => ({
        copy: state.copy,
        clipboardNodes: state.clipboardNodes,
        paste: state.paste,
      })),
    );
    const flowPaste = useFlowStore((state) => state.paste);

    const keyPressOptions = useMemo(
      () => ({
        target: targetRef.current,
        actInsideInputWithModifier: false,
      }),
      [targetRef],
    );

    // 复制节点
    const copyPressed = useKeyPress("Control+c", keyPressOptions);
    useEffect(() => {
      if (
        !allowCopy ||
        !copyPressed ||
        selectedNodes.length === 0 ||
        isTextEditorFocused()
      ) {
        return;
      }
      copy(selectedNodes, selectedEdges);
    }, [allowCopy, copy, copyPressed, isTextEditorFocused, selectedEdges, selectedNodes]);

    // 粘贴节点
    const pastePressed = useKeyPress("Control+v", keyPressOptions);
    useEffect(() => {
      if (
        !allowPaste ||
        !pastePressed ||
        clipboardNodes.length === 0 ||
        isTextEditorFocused()
      ) {
        return;
      }
      const content = paste();
      if (content) {
        flowPaste(content.nodes, content.edges);
      }
    }, [allowPaste, clipboardNodes, flowPaste, isTextEditorFocused, paste, pastePressed]);

    return null;
  },
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
const ViewportChangeMonitor = memo(
  ({
    documentId,
    projectionOnly,
  }: {
    documentId?: DocumentId;
    projectionOnly: boolean;
  }) => {
    const updateViewport = useFlowStore((state) => state.updateViewport);
    const setFileConfig = useFileStore((state) => state.setFileConfig);
    useOnViewportChange({
      onEnd: (viewport: Viewport) => {
        updateViewport(viewport);
        if (projectionOnly && documentId) {
          setPipelineViewport(documentId, viewport);
        } else {
          setFileConfig("savedViewport", { ...viewport });
        }
      },
    });
    return null;
  },
);
// 更新器
const UpdateMonitor = memo(({ disabled = false }: { disabled?: boolean }) => {
  const {
    debouncedSelectedNodes,
    debouncedSelectedEdges,
    debouncedTargetNode,
  } = useFlowStore(
    useShallow((state) => ({
      debouncedSelectedNodes: state.debouncedSelectedNodes,
      debouncedSelectedEdges: state.debouncedSelectedEdges,
      debouncedTargetNode: state.debouncedTargetNode,
    })),
  );
  const filesLength = useFileStore((state) => state.files.length);

  useDebounceEffect(
    () => {
      if (disabled) return;
      localSave();
    },
    [
      debouncedSelectedNodes,
      debouncedSelectedEdges,
      debouncedTargetNode,
      filesLength,
      disabled,
    ],
    {
      wait: 500,
    },
  );

  return null;
});

// 节点添加面板控制器
interface NodeAddPanelControllerProps {
  visible: boolean;
  screenPos: { x: number; y: number };
  quickCreateConnection: QuickCreateConnection | null;
  setScreenPos: (pos: { x: number; y: number }) => void;
  onClose: () => void;
}
const NodeAddPanelController = memo(
  ({
    visible,
    screenPos,
    quickCreateConnection,
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
      [setScreenPos],
    );

    return (
      <NodeAddPanel
        visible={visible}
        position={screenPos}
        flowPosition={flowPos}
        quickCreateConnection={quickCreateConnection}
        onClose={onClose}
        onReopen={handleReopen}
      />
    );
  },
);

interface MainFlowProps {
  readOnly?: boolean;
  documentId?: DocumentId;
}

function MainFlow({ readOnly: projectionReadOnly = false, documentId }: MainFlowProps) {
  const {
    nodes,
    edges,
    updateNodes,
    updateEdges,
    addEdge,
    updateSize,
    updateSelection,
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
      attachNodeToGroup: state.attachNodeToGroup,
      detachNodeFromGroup: state.detachNodeFromGroup,
    })),
  );
  const canvasBackgroundMode = useConfigStore(
    (state) => state.configs.canvasBackgroundMode,
  );
  const enableNodeSnap = useConfigStore(
    (state) => state.configs.enableNodeSnap,
  );
  const snapOnlyInViewport = useConfigStore(
    (state) => state.configs.snapOnlyInViewport,
  );
  const quickCreateNodeOnConnectBlank = useConfigStore(
    (state) => state.configs.quickCreateNodeOnConnectBlank,
  );

  // 嵌入模式权限控制
  const { isEmbed, isCapAllowed } = useEmbedMode();
  const readOnly = projectionReadOnly || (isEmbed && isCapAllowed("readOnly"));
  const allowCopy = !isEmbed || isCapAllowed("allowCopy");

  const selfElem = useRef<HTMLDivElement>(null);
  const pendingConnectionRef = useRef<OnConnectStartParams | null>(null);
  const connectionCompletedRef = useRef(false);
  const suppressNextPaneClickRef = useRef(false);

  // 节点添加面板状态
  const [nodeAddPanelVisible, setNodeAddPanelVisible] = useState(false);
  const [nodeAddPanelPos, setNodeAddPanelPos] = useState({ x: 0, y: 0 });
  const [quickCreateConnection, setQuickCreateConnection] =
    useState<QuickCreateConnection | null>(null);

  // 磁吸对齐参考线
  const [snapGuidelines, setSnapGuidelines] = useState<SnapGuideline[]>([]);

  // 选区右键菜单
  const [selectionMenuPos, setSelectionMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // 回调
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
        const allowed = allowedReadOnlyNodeChanges(changes);
        const blocked = changes.length !== allowed.length;
        if (blocked && isEmbed) {
          sendToParent("mpe:error", {
            code: "capability_denied",
            message: "当前为只读模式，禁止修改节点",
          });
        }
        if (allowed.length > 0) updateNodes(allowed);
        return;
      }
      updateNodes(changes);
    },
    [isEmbed, updateNodes, readOnly],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) {
        const allowed = allowedReadOnlyEdgeChanges(changes);
        const blocked = changes.length !== allowed.length;
        if (blocked && isEmbed) {
          sendToParent("mpe:error", {
            code: "capability_denied",
            message: "当前为只读模式，禁止修改边",
          });
        }
        if (allowed.length > 0) updateEdges(allowed);
        return;
      }
      updateEdges(changes);
    },
    [isEmbed, updateEdges, readOnly],
  );
  const onConnect = useCallback(
    (co: Connection) => {
      if (readOnly) {
        if (isEmbed) {
          sendToParent("mpe:error", {
            code: "capability_denied",
            message: "当前为只读模式，禁止添加连接",
          });
        }
        return;
      }
      connectionCompletedRef.current = true;
      addEdge(co);
    },
    [addEdge, isEmbed, readOnly],
  );
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (readOnly) return;
      pendingConnectionRef.current = params;
      connectionCompletedRef.current = false;
    },
    [readOnly],
  );
  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState?: FinalConnectionState,
    ) => {
      if (readOnly) return;

      const connectStart = pendingConnectionRef.current;
      pendingConnectionRef.current = null;

      if (
        !quickCreateNodeOnConnectBlank ||
        !connectStart ||
        connectionCompletedRef.current
      ) {
        connectionCompletedRef.current = false;
        return;
      }

      const endedOnBlank =
        !connectionState ||
        (!connectionState.isValid &&
          !connectionState.toNode &&
          !connectionState.toHandle);

      if (!endedOnBlank) {
        connectionCompletedRef.current = false;
        return;
      }

      const clientX =
        "changedTouches" in event
          ? event.changedTouches[0]?.clientX
          : event.clientX;
      const clientY =
        "changedTouches" in event
          ? event.changedTouches[0]?.clientY
          : event.clientY;

      if (
        clientX == null ||
        clientY == null ||
        !connectStart.nodeId ||
        !connectStart.handleId ||
        connectStart.handleType !== "source"
      ) {
        connectionCompletedRef.current = false;
        return;
      }

      suppressNextPaneClickRef.current = true;
      setQuickCreateConnection({
        source: connectStart.nodeId,
        sourceHandle: connectStart.handleId,
      });
      setNodeAddPanelPos({ x: clientX, y: clientY });
      setNodeAddPanelVisible(true);

      connectionCompletedRef.current = false;
    },
    [quickCreateNodeOnConnectBlank, readOnly],
  );
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      updateSelection(params.nodes as NodeType[], params.edges as EdgeType[]);
    },
    [updateSelection],
  );

  // 双击空白区域打开节点添加面板
  const onPaneClick = useCallback(
    () => {
      if (suppressNextPaneClickRef.current) {
        suppressNextPaneClickRef.current = false;
        return;
      }

      // 单击关闭面板
      if (nodeAddPanelVisible) {
        setNodeAddPanelVisible(false);
        setQuickCreateConnection(null);
      }
    },
    [nodeAddPanelVisible],
  );

  // 双击处理
  const onDoubleClick = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      if (readOnly) return;
      setQuickCreateConnection(null);
      setNodeAddPanelPos({ x: event.clientX, y: event.clientY });
      setNodeAddPanelVisible(true);
    },
    [readOnly],
  );

  // 右键空白区域打开节点添加面板
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      if (readOnly) return;
      event.preventDefault();
      setQuickCreateConnection(null);
      setNodeAddPanelPos({ x: event.clientX, y: event.clientY });
      setNodeAddPanelVisible(true);
    },
    [readOnly],
  );

  // 关闭节点添加面板
  const closeNodeAddPanel = useCallback(() => {
    setNodeAddPanelVisible(false);
    setQuickCreateConnection(null);
  }, []);

  // 节点拖拽磁吸对齐
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: NodeType) => {
      if (!enableNodeSnap) return;
      const {
        nodes: currentNodes,
        viewport: currentViewport,
        size: currentSize,
      } = useFlowStore.getState();
      // 过滤拖拽节点和分组节点
      let otherNodes = currentNodes.filter(
        (n) => n.id !== draggedNode.id && n.type !== NodeTypeEnum.Group,
      );
      // 过滤可视范围内的节点
      if (snapOnlyInViewport) {
        otherNodes = filterNodesInViewport(otherNodes, {
          ...currentViewport,
          ...currentSize,
        });
      }
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
    [enableNodeSnap, snapOnlyInViewport, updateNodes],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: NodeType) => {
      setSnapGuidelines([]);

      // 磁吸对齐
      if (enableNodeSnap) {
        const {
          nodes: currentNodes,
          viewport: currentViewport,
          size: currentSize,
        } = useFlowStore.getState();
        // 过滤掉拖拽节点和分组节点
        let otherNodes = currentNodes.filter(
          (n) => n.id !== draggedNode.id && n.type !== NodeTypeEnum.Group,
        );
        // 过滤可视范围内的节点
        if (snapOnlyInViewport) {
          otherNodes = filterNodesInViewport(otherNodes, {
            ...currentViewport,
            ...currentSize,
          });
        }
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
      const selectedNodes = useFlowStore.getState().selectedNodes;
      const rfInstance = useFlowStore.getState().instance;

      // 获取需要处理的节点：所有选中的非分组节点
      const nodesToProcess = selectedNodes.filter(
        (n) => n.type !== NodeTypeEnum.Group,
      );
      if (nodesToProcess.length === 0 || !rfInstance) return;

      nodesToProcess.forEach((node) => {
        // 获取最新的节点数据
        const currentNode = currentNodes.find((n) => n.id === node.id);
        if (!currentNode) return;

        const hasParent = !!(currentNode as any).parentId;

        if (hasParent) {
          // 检测是否拖出了父 Group 的范围
          const parentId = (currentNode as any).parentId;
          const parentNode = currentNodes.find((n) => n.id === parentId);
          if (parentNode) {
            // 优先使用测量尺寸
            const pw =
              parentNode.measured?.width ??
              (parentNode as any).style?.width ??
              400;
            const ph =
              parentNode.measured?.height ??
              (parentNode as any).style?.height ??
              300;
            const nx = currentNode.position.x;
            const ny = currentNode.position.y;
            const nw = currentNode.measured?.width ?? 200;
            const nh = currentNode.measured?.height ?? 100;

            // 如果节点中心在 parent 外部则脱离
            const cx = nx + nw / 2;
            const cy = ny + nh / 2;

            if (cx < 0 || cy < 0 || cx > pw || cy > ph) {
              detachNodeFromGroup(currentNode.id);
            }
          }
        } else {
          const intersecting = rfInstance.getIntersectingNodes(
            currentNode as any,
          );
          const groupHit = intersecting.find(
            (n: any) => n.type === NodeTypeEnum.Group,
          );
          if (groupHit) {
            attachNodeToGroup(currentNode.id, groupHit.id);
          }
        }
      });
    },
    [
      enableNodeSnap,
      snapOnlyInViewport,
      updateNodes,
      attachNodeToGroup,
      detachNodeFromGroup,
    ],
  );

  // 选区右键菜单
  const onSelectionContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setSelectionMenuPos({ x: event.clientX, y: event.clientY });
  }, []);

  const onSelectionMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectionMenuPos(null);
    }
  }, []);

  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 1.5 }), []);

  // 背景颜色
  const backgroundColor = useMemo(() => {
    return canvasBackgroundMode === "pure" ? "#ffffff" : "#f9fafd";
  }, [canvasBackgroundMode]);

  // hook
  const ref = useRef(null);
  const { run: updateCanvasSize } = useDebounceFn(
    (width: number, height: number) => updateSize(width, height),
    { wait: 300 },
  );

  useEffect(() => {
    const element = ref.current;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const { width, height } = e.contentRect;
        updateCanvasSize(width, height);
      });
    });
    if (element) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  }, [updateCanvasSize]);

  // 渲染
  return (
    <div className={style.editor} ref={ref}>
      <FlowReadOnlyContext.Provider value={readOnly}>
          <ReactFlow
            ref={selfElem}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onNodesChange={onNodesChange}
            edgeTypes={edgeTypes}
            edges={edges}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
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
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
            elementsSelectable
            autoPanOnConnect={false}
            autoPanOnNodeDrag={false}
            preventScrolling
            elevateNodesOnSelect
          >
            <Background bgColor={backgroundColor} />
            <Controls orientation="vertical" />
            <InstanceMonitor />
            <ViewportChangeMonitor
              documentId={documentId}
              projectionOnly={projectionReadOnly}
            />
            <KeyListener
              targetRef={selfElem}
              allowCopy={!readOnly && allowCopy}
              allowPaste={!readOnly}
            />
            <UpdateMonitor disabled={projectionReadOnly} />
          {!readOnly && (
            <NodeAddPanelController
              visible={nodeAddPanelVisible}
              screenPos={nodeAddPanelPos}
              quickCreateConnection={quickCreateConnection}
              setScreenPos={setNodeAddPanelPos}
              onClose={closeNodeAddPanel}
            />
          )}
          {!readOnly && <InlineFieldPanel />}
          {!readOnly && <InlineEdgePanel />}
            {!readOnly && <SnapGuidelines guidelines={snapGuidelines} />}
          </ReactFlow>
      </FlowReadOnlyContext.Provider>
      {/* 选区右键菜单 */}
      {!readOnly && (
        <SelectionContextMenu
          position={selectionMenuPos}
          open={!!selectionMenuPos}
          onOpenChange={onSelectionMenuOpenChange}
        />
      )}
    </div>
  );
}

export default MainFlow;
