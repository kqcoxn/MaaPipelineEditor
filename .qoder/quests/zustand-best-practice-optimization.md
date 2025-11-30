# Zustand Store 优化方案

## 概述

本设计方案基于 Zustand 最佳实践范式，对现有 store 架构进行拆分与重构，旨在提升代码可维护性、减少耦合度、改善性能表现。核心策略包括：按职责拆分 store、采用 Slices 模式组合、消除模块级变量、提取专职模块。

## 当前架构问题分析

### 职责混杂

#### flowStore 臃肿问题

- 单一 store 承担视口、选择、历史、图数据等多重职责
- 920 行代码导致认知负担高
- 工具函数与 store 逻辑混合，边界不清

#### configStore 杂糅问题

- 应用配置、UI 状态、剪贴板功能混合
- 剪贴板逻辑应独立为专职 store

### 模块级变量隐患

#### 历史管理变量

- `historyStack`、`historyIndex`、`saveHistoryTimeout`、`lastSavedState` 为模块级变量
- 破坏状态封装性，无法通过 DevTools 观察
- 多实例场景下共享问题
- 测试困难

#### 计数器变量

- `nodeIdCounter`、`pasteIdCounter`、`fileIdCounter` 等全局计数器
- 缺乏重置机制，状态不可追溯

### 跨 Store 依赖

#### 循环依赖风险

- flowStore 直接调用 `useConfigStore.getState()`、`useFileStore.getState()`
- configStore 调用 `useFlowStore.getState()`
- 形成紧耦合，难以独立测试

## 优化方案设计

### Store 拆分架构

#### 核心职责划分

采用 Slices 模式将原 flowStore 拆分为 4 个独立 slice：

**flowViewSlice（视口与实例）**

- 职责范围
  - ReactFlow 实例管理
  - 视口状态（位置、缩放）
  - 画布尺寸
- 关键状态
  - `instance`
  - `viewport`
  - `size`
- 核心操作
  - `updateInstance`
  - `updateViewport`
  - `updateSize`

**flowSelectionSlice（选择管理）**

- 职责范围
  - 选中节点集合
  - 选中边集合
  - 目标节点（Field Panel 展示用）
- 关键状态
  - `selectedNodes`
  - `selectedEdges`
  - `targetNode`
  - 缓冲状态（`bfSelectedNodes`、`bfSelectedEdges`、`bfTargetNode`）
- 核心操作
  - `selectNodes`
  - `selectEdges`
  - `clearSelection`
  - `setTargetNode`

**flowHistorySlice（历史管理）**

- 职责范围
  - 撤销/重做栈管理
  - 快照生成与恢复
  - 历史状态查询
- 关键状态（消除模块级变量）
  - `historyStack`
  - `historyIndex`
  - `saveTimeout`（用于防抖）
  - `lastSavedState`（用于去重）
- 核心操作
  - `saveHistory`
  - `undo`
  - `redo`
  - `initHistory`
  - `clearHistory`
  - `getHistoryState`

**flowGraphSlice（图数据）**

- 职责范围
  - 节点/边数据存储
  - 图操作（增删改）
  - ID 生成管理
- 关键状态（消除模块级变量）
  - `nodes`
  - `edges`
  - `nodeIdCounter`
  - `pasteIdCounter`
- 核心操作
  - `addNode`
  - `updateNodes`
  - `setNodeData`
  - `addEdge`
  - `updateEdges`
  - `replace`
  - `paste`
  - `generateNodeId`

#### 独立模块提取

**clipboardStore（剪贴板管理）**

- 职责范围
  - 节点/边复制存储
  - 粘贴操作执行
- 关键状态
  - `clipboardNodes`
  - `clipboardEdges`
- 核心操作
  - `copy`
  - `paste`
- 与 configStore 解耦，成为独立职责模块

**configStore 瘦身**

- 保留职责
  - 应用配置项
  - UI 状态（如面板显示控制）
- 移除职责
  - 剪贴板逻辑 → clipboardStore

### Slices 组合策略

#### 组合方式

采用工厂函数模式组合 slices：

```
组合流程：
1. 定义各 slice 的 StateCreator 函数
2. 在主 store 中通过展开运算符合并
3. 支持跨 slice 访问（通过 get/set 参数）
```

#### 类型定义结构

```
类型层级：
FlowViewState → flowViewSlice 状态与操作
FlowSelectionState → flowSelectionSlice 状态与操作
FlowHistoryState → flowHistorySlice 状态与操作
FlowGraphState → flowGraphSlice 状态与操作
FlowStore = FlowViewState & FlowSelectionState & FlowHistoryState & FlowGraphState
```

#### 跨 Slice 协调

通过订阅模式或事件机制处理跨 slice 协作，避免直接依赖：

**事件驱动机制**

- 场景：历史管理需监听图数据变化
- 方案：graphSlice 操作完成后发布事件，historySlice 订阅事件触发保存

**状态计算属性**

- 场景：selection 依赖 graph 中的节点
- 方案：使用 `get()` 访问其他 slice 状态，保持单向依赖

### 跨 Store 依赖解耦

#### 解耦策略

**依赖注入模式**

- 需要外部配置的 slice（如 historySlice 需要 `historyLimit`）通过参数传入
- 避免直接调用 `useConfigStore.getState()`

**事件总线模式**

- 对于松散协作场景（如错误检查、消息通知），通过中介者协调
- 示例：图数据变化触发节点名查重，通过事件通知 errorStore

**订阅模式**

- Zustand 支持 `subscribe` 方法监听 store 变化
- 示例：fileStore 订阅 flowGraphStore 变化，触发自动保存

#### 依赖关系重构表

| 原耦合关系                          | 优化方案                         |
| ----------------------------------- | -------------------------------- |
| flowStore → configStore（获取配置） | 配置项通过函数参数传入           |
| flowStore → fileStore（保存文件）   | fileStore 订阅 graphSlice 变化   |
| flowStore → errorStore（错误检查）  | 通过事件总线触发检查             |
| configStore → flowStore（粘贴操作） | 独立 clipboardStore 持有节点引用 |

### 工具函数模块化

#### 独立工具模块

**节点工具（nodeUtils）**

- `findNodeById`
- `findNodeByLabel`
- `createPipelineNode`
- `createExternalNode`
- `checkRepeatNodeLabelList`

**边工具（edgeUtils）**

- `findEdgeById`
- `calcuLinkOrder`

**视口工具（viewportUtils）**

- `fitFlowView`
- `calcuNodePosition`

#### 工具与 Store 交互

工具函数通过接收 store 实例或状态快照作为参数，避免内部调用 `getState()`：

```
参数化设计：
calcuNodePosition(selectedNodes, viewport, size) → PositionType
checkRepeatNodeLabelList(nodes, config) → string[]
```

### 状态缓冲机制优化

#### 现有缓冲逻辑

- `bfSelectedNodes`、`bfSelectedEdges`、`bfTargetNode` 通过 `buData` 函数延迟更新
- 目的：减少高频 UI 更新

#### 优化方案

**明确缓冲语义**

- 将缓冲状态归入 selectionSlice
- 重命名为 `debounced*` 系列，明确用途

**优化防抖实现**

- 将 `buTimeout` 对象存入 slice 状态
- 支持取消与清理

### 历史管理改进

#### 状态内化

将所有历史相关变量纳入 historySlice 状态：

| 原模块级变量         | 迁移后状态字段         |
| -------------------- | ---------------------- |
| `historyStack`       | `history.stack`        |
| `historyIndex`       | `history.index`        |
| `saveHistoryTimeout` | `history.saveTimeout`  |
| `lastSavedState`     | `history.lastSnapshot` |

#### 快照优化策略

**去重机制**

- 通过 `lastSnapshot` 字段存储序列化状态
- 新快照前对比，避免重复保存

**性能优化**

- 使用 `structuredClone`（优先）或 `JSON.parse/stringify` 快速克隆
- 排除 UI 状态（`selected`、`dragging`）减少快照体积

**限制管理**

- 根据 `historyLimit` 配置限制栈大小
- 超出时移除最早快照

## 实施细节

### Store 文件组织

```
stores/
├── flow/
│   ├── slices/
│   │   ├── viewSlice.ts        # 视口与实例
│   │   ├── selectionSlice.ts   # 选择管理
│   │   ├── historySlice.ts     # 历史管理
│   │   └── graphSlice.ts       # 图数据
│   ├── index.ts                # 组合 slices
│   └── types.ts                # 类型定义
├── clipboardStore.ts           # 剪贴板
├── configStore.ts              # 配置（瘦身后）
├── fileStore.ts                # 文件管理
└── errorStore.ts               # 错误管理
```

### Slice 组合实现

#### 主 Store 结构

通过 `create` 函数合并所有 slices：

```
实现流程：
1. 导入各 slice 的 StateCreator
2. 在 create 回调中展开各 slice
3. 确保类型正确推断
```

#### 跨 Slice 访问

通过 `get` 和 `set` 参数实现跨 slice 状态访问：

```
访问模式：
- selectionSlice 访问 graphSlice 的 nodes：通过 get().nodes
- historySlice 保存快照时读取 graphSlice：通过 get().nodes 和 get().edges
```

### ID 生成器设计

#### Counter 状态化

将所有计数器纳入对应 slice：

| 计数器           | 归属 Slice | 状态字段           |
| ---------------- | ---------- | ------------------ |
| `nodeIdCounter`  | graphSlice | `idCounters.node`  |
| `pasteIdCounter` | graphSlice | `idCounters.paste` |
| `fileIdCounter`  | fileStore  | `idCounter`        |

#### 重置机制

提供 `resetCounters` 操作，支持测试与状态清理。

### 订阅与事件机制

#### Zustand Subscribe

利用 Zustand 的 `subscribe` API 监听状态变化：

```
订阅场景：
- fileStore 订阅 graphSlice 的 nodes/edges 变化，触发自动保存
- historySlice 可订阅 graphSlice 变化，触发快照保存
```

#### 自定义事件总线

对于松散的跨 store 通信（如错误检查），实现轻量事件系统：

```
事件类型：
- GRAPH_CHANGED：图数据变化
- NODE_LABEL_CHANGED：节点名变化
订阅者：
- errorStore 监听 NODE_LABEL_CHANGED，触发查重
```

### 配置注入方式

#### Slice 工厂函数

需要外部配置的 slice 使用工厂模式：

```
工厂参数：
createHistorySlice(config: { historyLimit: number })
createGraphSlice(config: { autoFocus: boolean })
```

#### 配置读取时机

对于运行时动态配置，通过订阅 configStore 变化更新：

```
订阅逻辑：
configStore.subscribe((state) => {
  flowStore.setState({ historyLimit: state.configs.historyLimit })
})
```

## 重构影响评估

### 兼容性策略

#### 导出接口保持

在新 store 的 `index.ts` 中重新导出常用函数，保持向后兼容：

```
导出清单：
- useFlowStore（合并后的 store）
- 工具函数（findNodeById、createPipelineNode 等）
- 类型定义（NodeType、EdgeType 等）
```

#### 渐进式迁移

支持新旧 API 并存，逐步替换：

```
迁移阶段：
1. 新 slices 与旧 store 并存
2. 逐步替换组件中的 store 调用
3. 移除旧 store 代码
```

### 受影响组件

#### 直接使用 flowStore 的组件

| 组件            | 使用场景                           | 适配方案                           |
| --------------- | ---------------------------------- | ---------------------------------- |
| Flow.tsx        | 获取 nodes/edges、调用 updateNodes | 使用新 graphSlice selectors        |
| FieldPanel.tsx  | 获取 targetNode、调用 setNodeData  | 使用 selectionSlice 和 graphSlice  |
| ToolPanel.tsx   | 调用 addNode、undo/redo            | 使用 graphSlice 和 historySlice    |
| ConfigPanel.tsx | 读取配置、调用粘贴                 | 使用 configStore 和 clipboardStore |

#### 订阅模式影响

新增订阅逻辑不影响现有组件，但需确保：

- 订阅在组件卸载时清理
- 避免循环订阅

### 性能影响

#### 预期改善

**细粒度订阅**

- 组件仅订阅所需 slice，减少无关更新
- 示例：FieldPanel 仅订阅 selectionSlice

**状态更新优化**

- 独立 slice 减少状态对象层级
- 提升 Zustand 的浅比较效率

**缓冲机制精简**

- 明确防抖职责，避免冗余 `buData` 调用

#### 潜在开销

**订阅管理成本**

- 多个 subscribe 调用需妥善管理生命周期
- 建议使用 React 的 `useEffect` 清理

**跨 Slice 访问**

- 通过 `get()` 访问会增加调用层级，但影响可忽略

## 测试策略

### 单元测试改进

#### Slice 独立测试

每个 slice 作为独立单元测试：

```
测试维度：
- 状态初始化
- 操作执行（如 addNode、undo）
- 状态变化验证
```

#### Mock 简化

slice 拆分后，测试时无需模拟整个 flowStore：

```
示例：
测试 historySlice 时，仅需提供 nodes/edges 模拟数据
无需关心 viewport、selection 等
```

### 集成测试

#### Store 组合测试

验证 slices 组合后的协作：

```
测试场景：
- graphSlice 添加节点后，historySlice 自动保存快照
- selectionSlice 选中节点后，targetNode 正确更新
```

#### 订阅机制测试

验证跨 store 订阅逻辑：

```
测试场景：
- fileStore 订阅 graphSlice，验证自动保存触发
- errorStore 订阅节点名变化，验证查重逻辑
```

## 迁移路线图

### 第一阶段：基础拆分（1-2 周）

#### 任务清单

- 创建 slices 目录结构
- 实现 viewSlice（视口与实例）
- 实现 selectionSlice（选择管理）
- 实现 graphSlice（图数据基础操作）
- 实现 historySlice（历史管理）
- 消除 historyStack 等模块级变量

#### 验证标准

- 所有 slice 通过单元测试
- 组合后的 store 功能与原 flowStore 等价
- DevTools 可观察所有状态

### 第二阶段：依赖解耦（1 周）

#### 任务清单

- 提取 clipboardStore
- 移除 configStore 中的剪贴板逻辑
- 实现订阅机制（fileStore 订阅 graphSlice）
- 重构跨 store 调用为事件驱动

#### 验证标准

- 各 store 可独立测试
- 无循环依赖
- 自动保存、查重等功能正常

### 第三阶段：组件适配（1-2 周）

#### 任务清单

- 更新 Flow.tsx 使用新 slices
- 更新 FieldPanel.tsx 使用 selectionSlice
- 更新 ToolPanel.tsx 使用 graphSlice 和 historySlice
- 更新 ConfigPanel.tsx 使用 clipboardStore
- 移除旧 flowStore 向后兼容层

#### 验证标准

- 所有功能测试通过
- 无性能回归
- 用户操作体验一致

### 第四阶段：优化与文档（1 周）

#### 任务清单

- 性能 profiling 与优化
- 补充 slices 使用文档
- 更新架构文档
- 代码审查与重构

#### 验证标准

- 性能指标优于重构前
- 文档覆盖所有 slices
- 团队成员理解新架构

## 风险与应对

### 技术风险

#### 类型推断问题

**风险描述**

- Zustand slices 组合时 TypeScript 类型推断可能失败
- 循环类型引用导致编译错误

**应对措施**

- 使用 Zustand 官方文档推荐的 `StateCreator` 类型
- 显式声明每个 slice 的类型参数
- 必要时使用类型断言

#### 性能回归

**风险描述**

- 订阅机制不当导致频繁更新
- 跨 slice 访问增加调用开销

**应对措施**

- 使用 React DevTools Profiler 监控
- 细粒度 selector 减少不必要的重渲染
- 防抖/节流优化高频操作

### 业务风险

#### 功能遗漏

**风险描述**

- 重构过程中遗漏边缘功能
- 测试覆盖不全导致 bug

**应对措施**

- 重构前完善功能测试用例
- 渐进式迁移，每阶段回归测试
- 保留旧 store 作为对照验证

#### 团队学习成本

**风险描述**

- 团队成员不熟悉 slices 模式
- 开发效率短期下降

**应对措施**

- 提供 slices 模式培训
- 编写清晰的示例代码
- 代码审查确保正确使用

## 收益预期

### 代码质量提升

**可维护性**

- 单个 slice 文件行数控制在 200 行以内
- 职责明确，修改影响范围可控

**可测试性**

- 独立 slice 单元测试覆盖率 > 90%
- Mock 依赖简化，测试速度提升

**可扩展性**

- 新增功能时仅需添加新 slice
- 减少对现有代码的修改

### 开发体验改进

**调试便利**

- DevTools 可观察所有状态，无隐藏变量
- 状态变化路径清晰

**协作效率**

- 多人并行开发不同 slice，减少冲突
- 清晰的模块边界降低沟通成本

### 性能优化

**渲染优化**

- 组件细粒度订阅，减少 20-30% 无关渲染
- 大型画布操作流畅度提升

**内存优化**

- 历史快照去重机制减少内存占用
- 状态结构扁平化提升 GC 效率
