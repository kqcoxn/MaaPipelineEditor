# React Flow 学习指南

<cite>
**本文档引用的文件**  
- [README.md](file://README.md)
- [package.json](file://package.json)
- [main.tsx](file://src/main.tsx)
- [App.tsx](file://src/App.tsx)
- [Flow.tsx](file://src/components/Flow.tsx)
- [index.ts](file://src/stores/flow/index.ts)
- [nodes/index.ts](file://src/components/flow/nodes/index.ts)
- [edges.tsx](file://src/components/flow/edges.tsx)
- [index.ts](file://src/core/parser/index.ts)
- [server.ts](file://src/services/server.ts)
- [PipelineNode/index.tsx](file://src/components/flow/nodes/PipelineNode/index.tsx)
- [index.ts](file://src/core/fields/index.ts)
- [types.ts](file://src/stores/flow/types.ts)
- [vite.config.ts](file://vite.config.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [React Flow 集成](#react-flow-集成)
5. [节点系统](#节点系统)
6. [边（连接线）系统](#边连接线系统)
7. [状态管理](#状态管理)
8. [解析器模块](#解析器模块)
9. [本地服务通信](#本地服务通信)
10. [字段系统](#字段系统)
11. [配置与构建](#配置与构建)

## 简介

MaaPipelineEditor (MPE) 是一款基于 React Flow 的可视化工作流编辑器，专为 MaaFramework Pipeline 设计。该项目采用前后端完全分离架构，通过拖拽和配置的方式，帮助开发者高效构建和分享自动化流程。项目支持在线使用，无需下载安装，具备跨平台特性。

项目亮点包括：
- **极致轻量**：开箱即用，支持在线编辑
- **渐进扩展**：通过命令行可启用本地服务，无缝接入文件管理、截图工具等本地能力
- **所见即所得**：多种节点样式，支持节点聚焦和关键路径高亮
- **全面辅助**：内置识别小工具、流程化调试工具和节点预制模板
- **AI 赋能**：支持智能节点搜索和节点级 AI 补全
- **全面兼容**：支持旧项目一键导入和自动迁移

**Section sources**
- [README.md](file://README.md#L1-L143)

## 项目结构

MaaPipelineEditor 项目采用清晰的模块化结构，主要分为以下几个部分：

- **LocalBridge**：本地服务桥接，包含 Go 语言实现的后端服务
- **docsite**：文档站点，包含详细的使用文档
- **instructions**：详细的技术文档和 API 参考
- **src**：前端源代码，基于 React 和 TypeScript 构建
- **tools**：辅助工具脚本

前端核心代码位于 `src` 目录下，主要结构如下：
- `components`：UI 组件，包括 Flow 编辑器、节点、边等
- `stores`：Zustand 状态管理
- `core`：核心逻辑，包括解析器、字段系统等
- `services`：WebSocket 服务和协议处理
- `hooks`：自定义 React Hooks
- `utils`：工具函数

**Section sources**
- [README.md](file://README.md#L1-L143)

## 核心组件

MaaPipelineEditor 的核心组件包括 React Flow 编辑器、节点系统、边系统、状态管理和解析器模块。这些组件协同工作，实现了可视化工作流的构建和编辑功能。

**Section sources**
- [App.tsx](file://src/App.tsx#L1-L264)
- [Flow.tsx](file://src/components/Flow.tsx#L1-L336)

## React Flow 集成

MaaPipelineEditor 基于 React Flow 库构建，实现了完整的可视化工作流编辑功能。React Flow 是一个用于构建可交互流程图和节点编辑器的 React 库。

### 初始化和配置

在 `main.tsx` 中，项目初始化了 WebSocket 服务并渲染了 React 应用：

```typescript
import { initializeWebSocket } from "./services";
initializeWebSocket();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 主应用组件

`App.tsx` 是应用的主组件，负责整合各个面板和功能模块：

```typescript
function App() {
  // 初始化各种 store
  const debugMode = useDebugStore((state) => state.debugMode);
  
  // 处理文件拖拽导入
  const handleFileDrop = useCallback(async (e: DragEvent) => {
    // ...
  }, []);
  
  // 启用全局快捷键
  useGlobalShortcuts();
  
  // 初始化逻辑
  useEffect(() => {
    // 从本地存储加载数据
    useFileStore.getState().replace();
    
    // 从分享链接加载
    loadFromShareUrl();
    
    // 处理导入请求
    handleImportFromUrl();
    
    // 加载自定义模板
    useCustomTemplateStore.getState().loadTemplates();
    
    // WebSocket 状态同步
    localServer.onStatus((connected) => {
      useWSStore.getState().setConnected(connected);
    });
    
    // 自动连接本地服务
    if (wsAutoConnect || urlParams.linkLb) {
      localServer.connect();
    }
  }, [handleFileDrop, handleDragOver]);

  return (
    <ThemeProvider>
      <Flex className={style.container} gap="middle" wrap>
        <Layout className={style.layout}>
          <HeaderSection className={style.header}>
            <Header />
          </HeaderSection>
          <Content className={style.content}>
            <FilePanel />
            <div className={style.workspace}>
              <ToolbarPanel />
              <MainFlow />
              <JsonViewer />
              <FieldPanel />
              <EdgePanel />
              <ConfigPanel />
              <AIHistoryPanel />
              <LocalFileListPanel />
              <ToolPanel.Add />
              <ToolPanel.Global />
              <SearchPanel />
              {debugMode && <ToolPanel.Debug />}
              <ToolPanel.Layout />
              <ErrorPanel />
            </div>
          </Content>
        </Layout>
      </Flex>
      <GlobalListener />
    </ThemeProvider>
  );
}
```

### Flow 编辑器组件

`Flow.tsx` 实现了 React Flow 编辑器的核心功能：

```typescript
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

  // 回调函数
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
        <Controls orientation={"horizontal"} />
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
      </ReactFlow>
    </div>
  );
}
```

**Section sources**
- [main.tsx](file://src/main.tsx#L1-L18)
- [App.tsx](file://src/App.tsx#L1-L264)
- [Flow.tsx](file://src/components/Flow.tsx#L1-L336)

## 节点系统

MaaPipelineEditor 实现了三种主要的节点类型：Pipeline 节点、External 节点和 Anchor 节点。这些节点类型通过 React Flow 的 nodeTypes 机制进行注册和管理。

### 节点类型定义

在 `src/components/flow/nodes/index.ts` 中，定义了节点类型映射：

```typescript
export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: PipelineNodeMemo,
  [NodeTypeEnum.External]: ExternalNodeMemo,
  [NodeTypeEnum.Anchor]: AnchorNodeMemo,
};
```

### Pipeline 节点

Pipeline 节点是核心节点类型，包含识别、动作和其他参数。节点组件实现了丰富的交互功能：

```typescript
export function PipelineNode(props: NodeProps<PNodeData>) {
  const nodeStyle = useConfigStore((state) => state.configs.nodeStyle);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const { getNode } = useReactFlow();

  // 右键菜单状态
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // 获取完整的 Node 对象
  const node = getNode(props.id) as
    | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
    | undefined;

  // 获取选中状态、边信息和路径状态
  const { selectedNodes, selectedEdges, edges, pathMode, pathNodeIds } =
    useFlowStore(
      useShallow((state) => ({
        selectedNodes: state.selectedNodes,
        selectedEdges: state.selectedEdges,
        edges: state.edges,
        pathMode: state.pathMode,
        pathNodeIds: state.pathNodeIds,
      }))
    );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    // 透明度为1
    if (focusOpacity === 1) return true;

    // 路径模式
    if (pathMode && pathNodeIds.size > 0) {
      return pathNodeIds.has(props.id);
    }

    // 没有选中任何内容
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    // 当前节点被选中
    if (props.selected) return true;

    const nodeId = props.id;

    // 检查是否与选中的节点直接连接
    for (const selectedNode of selectedNodes) {
      // 查找与选中节点相连的边
      for (const edge of edges) {
        if (
          (edge.source === selectedNode.id && edge.target === nodeId) ||
          (edge.target === selectedNode.id && edge.source === nodeId)
        ) {
          return true;
        }
      }
    }

    // 检查是否与选中的边相连
    for (const selectedEdge of selectedEdges) {
      if (selectedEdge.source === nodeId || selectedEdge.target === nodeId) {
        return true;
      }
    }

    return false;
  }, [
    focusOpacity,
    selectedNodes,
    selectedEdges,
    edges,
    props.id,
    props.selected,
    pathMode,
    pathNodeIds,
  ]);

  const nodeClass = useMemo(
    () =>
      classNames({
        [style.node]: true,
        [style["pipeline-node"]]: true,
        [style["node-selected"]]: props.selected,
        [style["modern-node"]]: nodeStyle === "modern",
        // 调试相关样式
        [debugStyle["debug-node-executed"]]:
          debugMode && executedNodes.has(props.id),
        [debugStyle["debug-node-executing"]]:
          debugMode && currentNode === props.id,
      }),
    [props.selected, nodeStyle, debugMode, executedNodes, currentNode, props.id]
  );

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  return (
    <NodeContextMenu
      node={node}
      open={contextMenuOpen}
      onOpenChange={setContextMenuOpen}
    >
      <div className={nodeClass} style={opacityStyle}>
        {/* 断点标记 */}
        {debugMode && breakpoints.has(props.id) && (
          <div className={debugStyle["debug-node-breakpoint"]} />
        )}
        {nodeStyle === "modern" ? (
          <ModernContent data={props.data} props={props} />
        ) : (
          <ClassicContent data={props.data} props={props} />
        )}
      </div>
    </NodeContextMenu>
  );
}
```

### 节点数据类型

在 `src/stores/flow/types.ts` 中定义了节点数据类型：

```typescript
// Pipeline 节点数据类型
export type PipelineNodeDataType = {
  label: string;
  recognition: {
    type: string;
    param: RecognitionParamType;
  };
  action: {
    type: string;
    param: ActionParamType;
  };
  others: OtherParamType;
  extras?: any;
  type?: NodeTypeEnum;
};

// Pipeline 节点类型
export interface PipelineNodeType {
  id: string;
  type: NodeTypeEnum;
  data: PipelineNodeDataType;
  position: PositionType;
  dragging?: boolean;
  selected?: boolean;
  measured?: {
    width: number;
    height: number;
  };
}
```

**Section sources**
- [nodes/index.ts](file://src/components/flow/nodes/index.ts#L1-L14)
- [PipelineNode/index.tsx](file://src/components/flow/nodes/PipelineNode/index.tsx#L1-L214)
- [types.ts](file://src/stores/flow/types.ts#L1-L289)

## 边（连接线）系统

MaaPipelineEditor 实现了自定义的边（连接线）系统，支持多种连接类型和交互功能。

### 边类型定义

在 `src/components/flow/edges.tsx` 中定义了边类型：

```typescript
export const edgeTypes = {
  marked: memo(MarkedEdge),
};
```

### 自定义边组件

`MarkedEdge` 组件实现了丰富的边功能，包括路径控制点、标签显示和交互：

```typescript
function MarkedEdge(props: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow();
  const showEdgeLabel = useConfigStore((state) => state.configs.showEdgeLabel);
  const focusOpacity = useConfigStore((state) => state.configs.focusOpacity);
  const showEdgeControlPoint = useConfigStore(
    (state) => state.configs.showEdgeControlPoint
  );

  // 控制点拖拽状态
  const [controlOffset, setControlOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 监听重置键
  const edgeControlResetKey = useFlowStore(
    (state) => state.edgeControlResetKey
  );
  useEffect(() => {
    if (edgeControlResetKey > 0) {
      setControlOffset({ x: 0, y: 0 });
    }
  }, [edgeControlResetKey]);

  // 计算贝塞尔曲线路径
  const [edgePath, labelX, labelY] = useMemo(() => {
    const hasOffset = controlOffset.x !== 0 || controlOffset.y !== 0;

    if (hasOffset) {
      return getCustomBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition ?? "bottom",
        targetPosition: props.targetPosition ?? "top",
        controlOffset,
      });
    }

    return getStandardBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition ?? "bottom",
      targetPosition: props.targetPosition ?? "top",
    });
  }, [
    props.sourceX,
    props.sourceY,
    props.targetX,
    props.targetY,
    props.sourcePosition,
    props.targetPosition,
    controlOffset,
  ]);

  // 处理拖拽开始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialOffsetRef.current = { ...controlOffset };
    },
    [controlOffset]
  );

  // 处理拖拽移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      // 计算屏幕坐标的差值
      const deltaScreenX = e.clientX - dragStartRef.current.x;
      const deltaScreenY = e.clientY - dragStartRef.current.y;

      // 将屏幕坐标转换为 flow 坐标差值
      const startFlow = screenToFlowPosition({
        x: dragStartRef.current.x,
        y: dragStartRef.current.y,
      });
      const currentFlow = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const deltaX = currentFlow.x - startFlow.x;
      const deltaY = currentFlow.y - startFlow.y;

      setControlOffset({
        x: initialOffsetRef.current.x + deltaX,
        y: initialOffsetRef.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, screenToFlowPosition]);

  // 双击重置控制点
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setControlOffset({ x: 0, y: 0 });
  }, []);

  // 获取选中状态和路径状态
  const { selectedNodes, selectedEdges, pathMode, pathEdgeIds } = useFlowStore(
    useShallow((state) => ({
      selectedNodes: state.selectedNodes,
      selectedEdges: state.selectedEdges,
      pathMode: state.pathMode,
      pathEdgeIds: state.pathEdgeIds,
    }))
  );

  // 计算是否与选中元素相关联
  const isRelated = useMemo(() => {
    if (focusOpacity === 1) return true;

    // 路径模式
    if (pathMode && pathEdgeIds.size > 0) {
      return pathEdgeIds.has(props.id);
    }

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return true;
    if (props.selected) return true;

    // 检查边是否连接到选中的节点
    for (const selectedNode of selectedNodes) {
      if (
        props.source === selectedNode.id ||
        props.target === selectedNode.id
      ) {
        return true;
      }
    }

    return false;
  }, [
    focusOpacity,
    selectedNodes,
    selectedEdges,
    props.source,
    props.target,
    props.selected,
    props.id,
    pathMode,
    pathEdgeIds,
  ]);

  const edgeClass = useMemo(() => {
    let markClass = "";
    if (props.selected) {
      markClass = style["edge-selected"];
    } else {
      const hasJumpBack = edge?.attributes?.jump_back;

      switch (props.sourceHandleId) {
        case SourceHandleTypeEnum.Next:
          markClass = style["edge-next"];
          break;
        case SourceHandleTypeEnum.JumpBack:
          markClass = style["edge-jumpback"];
          break;
        case SourceHandleTypeEnum.Error:
          markClass = hasJumpBack
            ? style["edge-error-jumpback"]
            : style["edge-error"];
          break;
      }
    }

    // 如果 source 和 target 都已执行，则边也标记为已执行
    const isExecuted =
      debugMode &&
      executedNodes.has(props.source) &&
      executedNodes.has(props.target);

    return classNames(
      style.edge,
      markClass,
      isExecuted && debugStyle["debug-edge-executed"]
    );
  }, [
    props.selected,
    props.sourceHandleId,
    props.source,
    props.target,
    edge?.attributes?.jump_back,
    debugMode,
    executedNodes,
  ]);

  const labelClass = useMemo(
    () =>
      classNames({
        [style.label]: true,
        [style["label-selected"]]: props.selected,
      }),
    [props.selected]
  );
  const labelStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
    };
    // 应用透明度
    if (!isRelated && focusOpacity !== 1) {
      baseStyle.opacity = focusOpacity;
    }
    return baseStyle;
  }, [labelX, labelY, isRelated, focusOpacity]);

  // 计算透明度样式
  const opacityStyle = useMemo(() => {
    if (isRelated || focusOpacity === 1) return undefined;
    return { opacity: focusOpacity };
  }, [isRelated, focusOpacity]);

  // 是否有偏移
  const hasOffset = controlOffset.x !== 0 || controlOffset.y !== 0;

  // 控制点样式
  const controlPointStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
      cursor: isDragging ? "grabbing" : "grab",
    };
    // 拖拽过的控制点需要显示
    if (hasOffset && !isDragging) {
      baseStyle.opacity = 0.7;
    }
    // 应用聚焦透明度
    if (!isRelated && focusOpacity !== 1) {
      baseStyle.opacity = focusOpacity;
    }
    return baseStyle;
  }, [labelX, labelY, isDragging, hasOffset, isRelated, focusOpacity]);

  return (
    <g style={opacityStyle}>
      <BaseEdge className={edgeClass} id={props.id} path={edgePath} />
      <EdgeLabelRenderer>
        {/* 可拖拽的控制点 */}
        {showEdgeControlPoint && (
          <div
            className={classNames(style["control-point"], {
              [style["control-point-dragging"]]: isDragging,
              [style["control-point-offset"]]:
                controlOffset.x !== 0 || controlOffset.y !== 0,
            })}
            style={controlPointStyle}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title="拖拽调整路径，双击重置"
          />
        )}
        {/* 标签 */}
        {showEdgeLabel && props.label != null ? (
          <div className={labelClass} style={labelStyle}>
            {props.label}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </g>
  );
}
```

### 边数据类型

在 `src/stores/flow/types.ts` 中定义了边数据类型：

```typescript
// 边属性类型
export type EdgeAttributesType = {
  jump_back?: boolean;
  anchor?: boolean;
};

// 边类型
export type EdgeType = {
  id: string;
  source: string;
  sourceHandle: SourceHandleTypeEnum;
  target: string;
  targetHandle: "target";
  label: number;
  type: "marked";
  selected?: boolean;
  attributes?: EdgeAttributesType;
};
```

**Section sources**
- [edges.tsx](file://src/components/flow/edges.tsx#L1-L456)
- [types.ts](file://src/stores/flow/types.ts#L1-L289)

## 状态管理

MaaPipelineEditor 使用 Zustand 进行状态管理，将复杂的编辑器状态分解为多个 slice，实现了高效的状态管理和更新。

### 状态存储结构

在 `src/stores/flow/index.ts` 中，项目使用 createStore 创建了组合状态：

```typescript
// 组合所有 slices
export const useFlowStore = create<FlowStore>()((...a) => ({
  ...createViewSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createNodeSlice(...a),
  ...createEdgeSlice(...a),
  ...createGraphSlice(...a),
  ...createPathSlice(...a),
}));
```

### 状态 Slice

项目将状态分解为多个 slice，每个 slice 负责管理特定领域的状态：

- **ViewSlice**：视口状态管理
- **SelectionSlice**：选择状态管理
- **HistorySlice**：历史记录管理
- **NodeSlice**：节点状态管理
- **EdgeSlice**：边状态管理
- **GraphSlice**：图数据管理
- **PathSlice**：路径模式管理

### 状态类型定义

在 `src/stores/flow/types.ts` 中定义了完整的状态类型：

```typescript
// 合并的 Flow Store 类型
export type FlowStore = FlowViewState &
  FlowSelectionState &
  FlowHistoryState &
  FlowNodeState &
  FlowEdgeState &
  FlowGraphState &
  FlowPathState;
```

### 状态使用示例

在 `Flow.tsx` 中，通过 useFlowStore Hook 使用状态：

```typescript
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
```

**Section sources**
- [index.ts](file://src/stores/flow/index.ts#L1-L101)
- [types.ts](file://src/stores/flow/types.ts#L1-L289)

## 解析器模块

MaaPipelineEditor 的解析器模块负责在可视化编辑器格式和 Pipeline JSON 格式之间进行转换。

### 模块结构

在 `src/core/parser/index.ts` 中，解析器模块被重构为多个子模块：

```typescript
/**
 * Parser 模块 - Pipeline 格式与 Flow 格式互转
 *
 * 该模块负责 MaaPipelineEditor 的核心解析功能：
 * - flowToPipeline: 将可视化编辑器的 Flow 格式转换为 Pipeline JSON 格式
 * - pipelineToFlow: 将 Pipeline JSON 格式解析为可视化编辑器的 Flow 格式
 *
 * 模块已被重构为多个子模块以提高可维护性：
 * - types: 类型定义
 * - typeMatchers: 类型匹配与转换
 * - versionDetector: 版本检测与兼容
 * - configParser: 配置解析
 * - edgeLinker: 边连接逻辑
 * - nodeParser: 节点解析
 * - exporter: 导出逻辑
 * - importer: 导入逻辑
 */

export { flowToPipeline, flowToPipelineString, flowToSeparatedStrings } from "./exporter";
export { pipelineToFlow } from "./importer";
export {
  splitPipelineAndConfig,
  mergePipelineAndConfig,
  getConfigFileName,
  getPipelineFileNameFromConfig,
} from "./configSplitter";

// 导出类型
export type {
  ParsedPipelineNodeType,
  PipelineObjType,
  IdLabelPairsType,
  PipelineConfigType,
  MpeConfigType,
  FlowToOptions,
  PipelineToFlowOptions,
  NodeType,
  EdgeType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
} from "./types";
export type { NodeVersionInfo } from "./versionDetector";

// 导出常量
export {
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
  anchorMarkPrefix,
} from "./types";

// 工具函数
export { matchParamType } from "./typeMatchers";
export {
  detectNodeVersion,
  detectRecognitionVersion,
  detectActionVersion,
  normalizeRecoType,
  normalizeActionType,
} from "./versionDetector";
export {
  isConfigKey,
  isMark,
  getConfigMark,
  parsePipelineConfig,
} from "./configParser";
export {
  linkEdge,
  resetIdCounter,
  getNextId,
  parseNodeRef,
} from "./edgeLinker";
export type { NodeAttr, NodeRefType } from "./edgeLinker";
export {
  parsePipelineNodeForExport,
  parseExternalNodeForExport,
  parseRecognitionField,
  parseActionField,
  parseNodeField,
} from "./nodeParser";
```

### 核心功能

解析器模块提供了两个核心功能：

1. **flowToPipeline**：将 Flow 格式转换为 Pipeline JSON 格式
2. **pipelineToFlow**：将 Pipeline JSON 格式解析为 Flow 格式

这些功能使得用户可以在可视化编辑器中编辑流程，并将其导出为标准的 Pipeline JSON 格式，反之亦然。

**Section sources**
- [index.ts](file://src/core/parser/index.ts#L1-L84)

## 本地服务通信

MaaPipelineEditor 通过 WebSocket 与本地服务进行通信，实现了文件管理、调试等功能。

### WebSocket 服务

在 `src/services/server.ts` 中实现了 WebSocket 服务：

```typescript
export class LocalWebSocketServer {
  private ws: WebSocket | null = null;
  private url: string;
  private routes: Map<string, MessageHandler> = new Map();
  private onStatusChange?: (connected: boolean) => void;
  private onConnectingChange?: (isConnecting: boolean) => void;
  private connectTimeout: number | null = null;
  private isConnecting: boolean = false;
  private handshakeCompleted: boolean = false;
  private readonly CONNECTION_TIMEOUT = 3000;

  constructor(port: number = 9066) {
    this.url = `ws://localhost:${port}`;
    // 注册系统级路由
    this.registerSystemRoutes();
  }

  // 注册系统级路由
  private registerSystemRoutes() {
    // 握手响应处理
    this.routes.set(
      SystemRoutes.HANDSHAKE_RESPONSE,
      (data: HandshakeResponse) => {
        if (data.success) {
          this.handshakeCompleted = true;
          this.clearConnectTimeout();
          this.isConnecting = false;
          this.onConnectingChange?.(false);
          message.success(`已连接到本地服务`);
          this.onStatusChange?.(true);
        } else {
          console.error(
            "[WebSocket] 协议版本不匹配，前端需求:",
            PROTOCOL_VERSION,
            "，当前本地服务协议:",
            data.required_version
          );
          message.error(
            `协议版本不匹配，前端需求: ${PROTOCOL_VERSION}，当前本地服务协议: ${data.required_version}，请按后端提示更新`
          );
          // 主动断开连接
          this.disconnect();
        }
      }
    );
  }

  // 连接到 WebSocket 服务器
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn("[WebSocket] Already connected");
      return;
    }

    // 防止重复连接
    if (this.isConnecting) {
      console.warn("[WebSocket] Connection already in progress");
      message.warning("正在尝试连接本地服务中，请稍候...");
      return;
    }

    // 清除之前的超时定时器
    this.clearConnectTimeout();
    this.isConnecting = true;
    this.onConnectingChange?.(true);

    try {
      this.ws = new WebSocket(this.url);

      // 设置连接超时
      this.connectTimeout = window.setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error("[WebSocket] Connection timeout");
          message.error(`连接超时，请检查本地服务或端口是否可用`);
          this.ws.close();
          this.ws = null;
          this.isConnecting = false;
          this.onConnectingChange?.(false);
          this.onStatusChange?.(false);
        }
      }, this.CONNECTION_TIMEOUT);

      this.ws.onopen = () => {
        // 发送版本握手请求
        this.sendHandshake();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { path, data } = message;

          if (path && this.routes.has(path)) {
            const handler = this.routes.get(path)!;
            handler(data, this.ws!);
          } else {
            console.warn("[WebSocket] No handler for path:", path);
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        this.clearConnectTimeout();
        this.isConnecting = false;
        this.onConnectingChange?.(false);
        message.error(`连接失败，请检查本地服务或端口是否可用`);
      };

      this.ws.onclose = () => {
        this.clearConnectTimeout();
        this.isConnecting = false;
        this.onConnectingChange?.(false);
        message.info("本地服务已断开连接");
        this.onStatusChange?.(false);
        this.ws = null;
      };
    } catch (error) {
      console.error("[WebSocket] Connection failed:", error);
      this.clearConnectTimeout();
      this.isConnecting = false;
      this.onConnectingChange?.(false);
      message.error(
        `本地服务连接失败：${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      this.onStatusChange?.(false);
    }
  }

  // 断开连接
  disconnect() {
    this.clearConnectTimeout();
    this.isConnecting = false;
    this.handshakeCompleted = false;
    this.onConnectingChange?.(false);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.onStatusChange?.(false);
  }

  // 发送版本握手请求
  private sendHandshake() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Cannot send handshake, not connected");
      return;
    }

    const handshakeData = {
      path: SystemRoutes.HANDSHAKE,
      data: {
        protocol_version: PROTOCOL_VERSION,
      },
    };

    this.ws.send(JSON.stringify(handshakeData));
  }

  // 发送消息
  send(path: string, data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Not connected, cannot send message");
      return false;
    }

    try {
      const message = JSON.stringify({ path, data });
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
      return false;
    }
  }

  // 获取连接状态
  isConnected(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.handshakeCompleted
    );
  }

  // 是否正在连接中
  getIsConnecting(): boolean {
    return this.isConnecting;
  }

  // 清除连接超时定时器
  private clearConnectTimeout() {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  // 清理资源
  destroy() {
    this.disconnect();
    this.routes.clear();
    this.onStatusChange = undefined;
    this.onConnectingChange = undefined;
  }
}

export const localServer = new LocalWebSocketServer();

// 创建全局协议实例
export const fileProtocol = new FileProtocol();
export const mfwProtocol = new MFWProtocol();
export const errorProtocol = new ErrorProtocol();
export const configProtocol = new ConfigProtocol();
export const debugProtocol = new DebugProtocol();

/**
 * 初始化 WebSocket 连接和所有响应路由
 * 应在应用启动时调用一次
 */
export function initializeWebSocket() {
  // 注册 ErrorProtocol
  errorProtocol.register(localServer);

  // 注册 FileProtocol
  fileProtocol.register(localServer);

  // 注册 MFWProtocol
  mfwProtocol.register(localServer);

  // 注册 ConfigProtocol
  configProtocol.register(localServer);

  // 注册 DebugProtocol
  debugProtocol.register(localServer);

  // 监听连接成功事件，确保协议注册
  localServer.onStatus((connected) => {});
}
```

### 协议处理

项目实现了多个协议处理类，如 `FileProtocol`、`MFWProtocol` 等，通过注册路由来处理不同的消息类型。

**Section sources**
- [server.ts](file://src/services/server.ts#L1-L300)

## 字段系统

MaaPipelineEditor 的字段系统负责管理节点的各种参数字段，包括识别、动作和其他参数。

### 字段模块结构

在 `src/core/fields/index.ts` 中定义了字段系统的结构：

```typescript
// 类型定义
export type { FieldType, FieldsType, ParamKeysType } from "./types.js";

// 枚举
export { FieldTypeEnum } from "./fieldTypes.js";

// 识别字段
export {
  recoFieldSchema,
  recoFieldSchemaKeyList,
  recoFields,
} from "./recognition/index.js";

// 动作字段
export {
  actionFieldSchema,
  actionFieldSchemaKeyList,
  actionFields,
} from "./action/index.js";

// 其他字段
export {
  otherFieldParams,
  otherFieldParamsWithoutFocus,
  otherFieldSchemaKeyList,
  otherFieldSchema,
} from "./other/index.js";

// 工具函数
export { generateParamKeys, generateUpperValues } from "./utils.js";

// 辅助函数
export { createField, createFields } from "./fieldFactory.js";

// 生成参数键和大写值映射
import { recoFields } from "./recognition/index.js";
import { actionFields } from "./action/index.js";
import { generateParamKeys, generateUpperValues } from "./utils.js";

export const recoParamKeys = generateParamKeys(recoFields);
export const actionParamKeys = generateParamKeys(actionFields);
export const upperRecoValues = generateUpperValues(recoFields);
export const upperActionValues = generateUpperValues(actionFields);
```

### 参数类型定义

在 `src/stores/flow/types.ts` 中定义了各种参数类型：

```typescript
// 识别参数类型
export type RecognitionParamType = {
  roi?: XYWH | string;
  roi_offset?: XYWH;
  template?: string[];
  threshold?: number[];
  order_by?: string;
  index?: number;
  method?: number;
  green_mask?: boolean;
  count?: number;
  detector?: string;
  ratio?: number;
  lower?: number[][];
  upper?: number[][];
  connected?: boolean;
  expected?: string[] | number[];
  replace?: [string, string][];
  only_rec?: boolean;
  model?: string;
  labels?: string[];
  custom_recognition?: string;
  custom_recognition_param?: any;
  [key: string]: any;
};

// 动作参数类型
export type ActionParamType = {
  target?: XYWH | boolean | string;
  target_offset?: XYWH;
  duration?: number;
  begin?: XYWH;
  begin_offset?: XYWH;
  end?: XYWH;
  end_offset?: XYWH;
  swipes?: any[];
  key?: number;
  input_text?: string;
  package?: string;
  exec?: string;
  args?: string[];
  detach?: boolean;
  custom_action?: string;
  custom_action_param?: any;
  [key: string]: any;
};

// 其他参数类型
export type OtherParamType = {
  rate_limit?: number;
  timeout?: number;
  inverse?: boolean;
  enabled?: boolean;
  pre_delay?: number;
  post_delay?: number;
  pre_wait_freezes?: any;
  postWaitFreezes?: any;
  focus?: any;
  [key: string]: any;
};

// 参数合并类型
export type ParamType = RecognitionParamType & ActionParamType & OtherParamType;
```

**Section sources**
- [index.ts](file://src/core/fields/index.ts#L1-L44)
- [types.ts](file://src/stores/flow/types.ts#L1-L289)

## 配置与构建

MaaPipelineEditor 使用 Vite 作为构建工具，配置了多个构建模式。

### Vite 配置

在 `vite.config.ts` 中定义了构建配置：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  let base = "/stable/";
  if (mode === "preview") {
    base = "/MaaPipelineEditor/";
  } else if (mode !== "stable") {
    base = `/${mode}/`;
  }
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [
          "node_modules/",
          "tests/",
          "**/*.d.ts",
          "**/*.config.*",
          "**/mockData",
          "dist",
        ],
      },
    },
  };
});
```

### 构建脚本

在 `package.json` 中定义了构建脚本：

```json
"scripts": {
  "icon": "npx iconfont-h5",
  "dev": "vite",
  "server": "cd LocalBridge && yarn server",
  "doc": "cd docsite && yarn dev",
  "build": "vite build",
  "build-past": "vite build --mode mfw_5_0",
  "lint": "eslint .",
  "preview": "vite preview",
  "release": "vite build && git tag -a v0.14.0 -m \"v0.14.0\" && git push origin v0.14.0"
}
```

**Section sources**
- [vite.config.ts](file://vite.config.ts#L1-L39)
- [package.json](file://package.json#L1-L62)