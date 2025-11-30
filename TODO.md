# 二、分阶段重构优化建议（按优先级）

## 优先级 P1：通信层与契约治理

### 抽离"传输层"与"视图层"

- [ ] 重构 `LocalWebSocketServer`：仅负责连接、重连禁用（符合"失败不自动重试"偏好）、消息收发与事件回调（`onStatus`/`onConnecting`/`onMessage`），不直接弹 UI message。
- [ ] 在 UI 层或一个专用 notifier 模块中订阅事件并做反馈提示（遵循"链接失败时 message 提示""状态指示"的偏好）。

### 统一消息路由与类型

- [ ] 建立 `src/services/routes.ts`（或合并至 `type.ts`）声明常量：`ROUTE.ETC.SEND_PIPELINE`、`ROUTE.CTE.SEND_PIPELINE`、`ROUTE.API.REQUEST_PIPELINE`、`ROUTE.ERROR`，前后端共享约束。
- [ ] 为消息 `data` 定义 TypeScript 类型接口，并在 `onmessage` 中做 schema 校验（推荐 zod），提升鲁棒性；出错统一走"错误提示+日志"的路径。

## 优先级 P2：状态管理拆分与优化

### 按职责拆分 flowStore

- [ ] `flowViewStore`：实例、视口、尺寸；
- [ ] `flowSelectionStore`：选中节点/边、目标节点；
- [ ] `flowHistoryStore`：历史栈、undo/redo；
- [ ] `flowGraphStore`：节点/边数据与操作（`addNode`/`addEdge`/`updateNodes`/`updateEdges`）。
- [ ] 使用 Zustand slices 或工厂组合，减少文件体量与耦合度；历史栈的计数器与快照放入 store state，避免模块级变量。
- [ ] clipboard 与 config 相关逻辑尽量下沉到更清晰的模块（如 `src/stores/clipboardStore.ts`），减少 `configStore` 的杂糅。

## 优先级 P3：UI 结构与交互治理

- [ ] 将 `App.tsx` 的全局键盘监听抽象为 `hooks/useGlobalShortcuts.ts`，使用可控的订阅与解绑，避免对 `document` 的广域硬绑定。
- [ ] Header 主题切换按钮的样式优化（配合"白天黑夜按钮优化"偏好），但在工程侧应通过统一的主题切换 API/上下文，避免组件内部直接调用 `darkreader`。
- [ ] `ConfigPanel` 的"自动连接"逻辑保留，但把自动连接策略绑定至一个可取消的 effect 中，并暴露重试按钮，遵循"失败不自动重试"的偏好。

## 优先级 P4：服务端与打包治理

- [ ] 服务端共享路由常量（可生成到 Python 或用配置文件），减少魔法字符串。
- [ ] 增加"握手/健康检查"路由，前端在连接成功后立即检查服务端版本/能力；连接断开时提示与状态指示已具备，可保持。
- [ ] 打包到单文件 exe 的流程在 docsite 与 README 明确，前端"启动服务"脚本与 UI 的协作方式说明。

## 优先级 P5：测试与文档

### 引入 Vitest + React Testing Library

- [ ] stores 的单元测试（历史记录、选中态、粘贴板）；
- [ ] services 的契约测试（消息编解码、路由分派）。

### 文档完善

- [ ] docsite 补充"通信协议"与"本地服务运行方式"的最新约束（端口、超时、自动启动策略、前端状态指示），确保团队成员快速上手。
