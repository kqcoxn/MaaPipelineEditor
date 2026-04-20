# MaaPipelineEditor iframe 嵌入模式 PRD

## 1. 概述

### 1.1 背景

上游社区 VSCode 插件（下称"宿主"）希望在插件内嵌入 MaaPipelineEditor（下称"MPE"），以 iframe 为容器，让用户在 VSCode 中直接使用流程编辑器。MPE 需要为此提供一套**纯 postMessage 的轻量级通信协议**与**功能限制接口**，无需依赖 LocalBridge 服务。

### 1.2 合作定位

| 维度     | 归属 | 说明                                                   |
| -------- | ---- | ------------------------------------------------------ |
| 数据驱动 | 宿主 | 宿主负责数据来源——何时加载、何时保存、传入什么数据     |
| 接口设计 | MPE  | MPE 负责接口设计——提供哪些消息、支持哪些配置、如何响应 |

具体而言：

- **接口由 MPE 设计，宿主按需使用**：MPE 定义消息类型、capabilities 字段、可配置的面板范围等，并完整预留接口，宿主可根据自身需求选择性地接入
- **UI 由 MPE 实现，宿主表达偏好**：嵌入模式下的 UI 行为由 MPE 内部实现保证一致性，宿主通过 `capabilities` / `ui` 配置项表达期望，MPE 尽量尊重宿主偏好
- **数据流由宿主驱动**：何时加载 pipeline、何时保存、传入什么文件名，由宿主根据自身场景决定
- **接口预留，按需接入**：MPE 提供的接口不要求宿主全部实现，但会完整预留，方便宿主需要时直接接入

### 1.3 目标

- MPE 作为可嵌入组件，通过 URL 参数 `embed=true` 激活嵌入模式
- 宿主与 MPE 之间通过 `window.postMessage` 双向通信，不依赖任何后端服务
- 宿主可通过配置项表达对 MPE 功能与 UI 的偏好，MPE 尽量尊重并落地到实际行为
- 文件读写完全由宿主代理，MPE 不直接访问文件系统
- 尽可能复用或提升 MPE 现有实现（解析器、Store、组件），避免重复造轮子

### 1.4 非目标

- 不实现宿主端（VSCode 插件侧）代码，仅定义 MPE 侧需提供的接口
- 不涉及 LocalBridge 集成——嵌入模式下 MPE 不需要、也不会连接后端服务
- 不改变 MPE 现有的独立运行、在线服务、Wails 桌面端三种模式

---

## 2. 运行模式对比

| 维度     | 独立/在线模式  | Wails 桌面端              | iframe 嵌入模式            |
| -------- | -------------- | ------------------------- | -------------------------- |
| 通信方式 | WebSocket → LB | WebSocket + Wails Runtime | 纯 postMessage             |
| 后端依赖 | LocalBridge    | LocalBridge               | 无                         |
| 文件访问 | LB 文件服务    | LB 文件服务               | 宿主代理                   |
| 调试功能 | 通过 LB + MFW  | 通过 LB + MFW             | 不提供                     |
| 设备连接 | 通过 LB + MFW  | 通过 LB + MFW             | 不提供                     |
| UI 定制  | 无             | 无                        | MPE 定义规则，宿主表达偏好 |

---

## 3. 激活方式

MPE 通过 URL 参数检测嵌入模式：

```
https://mpe.codax.site/stable/?embed=true&origin=vscode-maa
```

| 参数     | 必填 | 说明                                                    |
| -------- | ---- | ------------------------------------------------------- |
| `embed`  | 是   | 设为 `true` 激活嵌入模式                                |
| `origin` | 否   | 声明宿主来源标识，用于 postMessage 的 origin 校验与调试 |

MPE 在 `App.tsx` 初始化阶段检测该参数，激活 `EmbedBridge` 替代常规的 WebSocket 连接流程。

---

## 4. 通信协议

### 4.1 消息格式

所有 postMessage 消息遵循统一信封格式：

```typescript
interface EmbedMessage {
  protocol: "mpe-embed"; // 协议标识，防止消息串扰
  version: string; // 协议版本，如 "1.0.0"
  type: string; // 消息类型，见 4.3 / 4.4
  requestId?: string; // 请求 ID（用于请求-响应模式匹配）
  payload: any; // 消息体
}
```

### 4.2 握手流程

```
宿主                              MPE (iframe)
  │                                  │
  │  ─── mpe:init ──────────────►    │
  │      { capabilities, ui, ... }   │
  │                                  │
  │  ◄──── mpe:ready ─────────────   │
  │      { version, supportedCaps }  │
  │                                  │
  │    (握手完成，正式通信)           │
```

1. iframe 加载完成后，宿主发送 `mpe:init`，携带权限声明与 UI 配置
2. MPE 根据声明配置自身，回复 `mpe:ready`
3. 握手完成前，MPE 忽略所有非 `mpe:init` 消息
4. 若超时（5s）未收到 `mpe:init`，MPE 按默认权限集运行

### 4.3 宿主 → MPE 消息类型

| 类型               | 说明                      | payload                | 响应              |
| ------------------ | ------------------------- | ---------------------- | ----------------- |
| `mpe:init`         | 握手 + 权限声明           | `EmbedInitConfig`      | `mpe:ready`       |
| `mpe:loadPipeline` | 加载 pipeline JSON 数据   | `{ fileName, data }`   | `mpe:loadResult`  |
| `mpe:save`         | 请求 MPE 回传当前流程数据 | 无                     | `mpe:saveData`    |
| `mpe:selectNode`   | 选中指定节点              | `{ nodeId }`           | —                 |
| `mpe:focusNode`    | 聚焦指定节点              | `{ nodeId }`           | —                 |
| `mpe:resize`       | 通知容器尺寸变化          | `{ width, height }`    | —                 |
| `mpe:state`        | 查询 MPE 当前状态         | `{ fields: string[] }` | `mpe:stateResult` |
| `mpe:destroy`      | 通知即将销毁 iframe       | 无                     | —                 |

### 4.4 MPE → 宿主消息类型

| 类型              | 说明                             | payload                                                                                                     |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mpe:ready`       | 初始化完成                       | `{ version, supportedCaps }`                                                                                |
| `mpe:loadResult`  | 加载结果                         | `{ success, error? }`                                                                                       |
| `mpe:saveData`    | 回传流程数据                     | `{ fileName, data }`                                                                                        |
| `mpe:change`      | 流程图变更通知                   | `{ type: 'node.add' \| 'node.delete' \| 'node.update' \| 'edge.add' \| 'edge.delete' \| 'layout', detail }` |
| `mpe:nodeSelect`  | 用户选中节点                     | `{ nodeId, nodeData? }`                                                                                     |
| `mpe:saveRequest` | MPE 主动请求保存（如快捷键触发） | `{ hint }`                                                                                                  |
| `mpe:stateResult` | 状态查询结果                     | `{ [field]: value }`                                                                                        |
| `mpe:error`       | 错误通知                         | `{ code, message, detail? }`                                                                                |

### 4.5 请求-响应模式

需响应的消息（`mpe:loadPipeline` → `mpe:loadResult`、`mpe:save` → `mpe:saveData`、`mpe:state` → `mpe:stateResult`）使用 `requestId` 关联：

1. 发送方在消息中携带 `requestId`（UUID）
2. 接收方在对应响应消息中回填相同的 `requestId`
3. 超时未收到响应，发送方可自行处理（超时建议 10s）

---

## 5. 权限与功能限制

> 设计原则：capabilities 与 UI 配置由 MPE 设计字段与取值范围，宿主在 `mpe:init` 中表达偏好，MPE 尽量尊重并生效。所有接口完整预留，宿主按需接入。

### 5.1 能力声明（capabilities）

宿主在 `mpe:init` 中表达期望的能力集合，MPE 尽量尊重并生效：

```typescript
interface EmbedCapabilities {
  readOnly: boolean; // 只读模式，禁止编辑流程图
  allowCopy: boolean; // 允许复制节点/边
  allowUndoRedo: boolean; // 允许撤销/重做
  allowAutoLayout: boolean; // 允许自动布局
  allowAI: boolean; // 允许 AI 辅助功能
  allowSearch: boolean; // 允许搜索
  allowCustomTemplate: boolean; // 允许自定义模板
}
```

MPE 在运行时根据生效的 capabilities：

- 禁用对应 UI 入口（按钮、菜单项、快捷键）——复用现有的面板显隐机制与条件渲染逻辑
- 拦截对应操作，若用户尝试执行则发送 `mpe:error`（`code: 'capability_denied'`）
- 权限判断逻辑统一收敛到 `EmbedContext`，各组件通过 Context 读取，零散的 `if-else` 不散落各处

### 5.2 默认权限集

若宿主未发送 `mpe:init`（超时场景），MPE 使用以下默认值：

| 能力                | 默认值 |
| ------------------- | ------ |
| readOnly            | false  |
| allowCopy           | true   |
| allowUndoRedo       | true   |
| allowAutoLayout     | true   |
| allowAI             | false  |
| allowSearch         | true   |
| allowCustomTemplate | true   |

默认集偏保守，仅开放核心编辑能力，关闭需要外部依赖的功能。

### 5.3 UI 控制

MPE 定义可配置的 UI 项与取值范围，宿主表达偏好，MPE 内部逻辑最终决定表现：

可隐藏的面板 ID 参考（复用现有 `panelOccupancyStore` 的面板 ID 体系）：

| 面板 ID               | 说明         |
| --------------------- | ------------ |
| `field`               | 字段面板     |
| `edge`                | 边面板       |
| `search`              | 搜索面板     |
| `file`                | 文件面板     |
| `config`              | 配置面板     |
| `ai-history`          | AI 历史面板  |
| `local-file`          | 本地文件面板 |
| `error`               | 错误面板     |
| `recognition-history` | 识别历史面板 |
| `toolbar`             | 工具栏面板   |
| `logger`              | 日志面板     |
| `exploration`         | 流程探索面板 |

### 5.4 复用现有实现

嵌入模式应尽可能复用或提升 MPE 现有代码，而非平行实现：

| 现有模块                            | 复用方式                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `pipelineToFlow` / `flowToPipeline` | 直接用于 `mpe:loadPipeline` / `mpe:saveData` 的序列化与反序列化     |
| `useFlowStore`                      | 加载/保存操作复用 Store 的 `loadPipeline` / `exportPipeline` action |
| `panelOccupancyStore`               | 面板显隐复用现有面板 ID 体系与布局避让逻辑                          |
| `useGlobalShortcuts`                | 在嵌入模式下根据 capabilities 注册/注销快捷键                       |
| `wailsBridge.ts` 模式               | `EmbedBridge` 镜像 `wailsBridge` 的环境检测 + 条件桥接模式          |

### 5.5 完整的 EmbedInitConfig

```typescript
interface EmbedUIConfig {
  hideHeader: boolean; // 隐藏顶部导航栏
  hideToolbar: boolean; // 隐藏左侧工具栏
  hiddenPanels: string[]; // 隐藏的面板 ID 列表
}

interface EmbedInitConfig {
  capabilities: EmbedCapabilities;
  ui: EmbedUIConfig;
}
```

---

## 6. 文件数据流

嵌入模式下，MPE 不直连任何文件系统，所有文件操作通过 postMessage 由宿主代理：

### 6.1 加载流程

```
宿主                              MPE (iframe)
  │                                  │
  │  ─── mpe:loadPipeline ──────►    │
  │      { fileName, data }          │
  │                                  │  解析 JSON → 渲染流程图
  │  ◄──── mpe:loadResult ───────   │
  │      { success }                 │
```

### 6.2 保存流程

```
场景A：宿主主动请求保存
宿主                              MPE (iframe)
  │                                  │
  │  ─── mpe:save ──────────────►    │
  │                                  │  序列化当前流程图
  │  ◄──── mpe:saveData ─────────   │
  │      { fileName, data }          │
  │                                  │
  │  (宿主将 data 写入文件系统)       │


场景B：用户在 MPE 内触发保存（Ctrl+S）
宿主                              MPE (iframe)
  │                                  │
  │  ◄──── mpe:saveRequest ────────  │
  │      { hint }                    │
  │                                  │
  │  (宿主决定是否保存)               │
  │  ─── mpe:save ──────────────►    │
  │                                  │
  │  ◄──── mpe:saveData ─────────   │
  │      { fileName, data }          │
```

### 6.3 数据格式

`mpe:loadPipeline` 和 `mpe:saveData` 中 `data` 字段为 MaaFramework 标准 pipeline JSON 对象，与 MPE 现有的 `pipelineToFlow` / `flowToPipeline` 解析逻辑完全一致，无需额外转换。

---

## 7. 生命周期

```
宿主创建 iframe
      │
      ▼
MPE 加载，检测 embed=true
      │
      ▼
MPE 进入嵌入模式，等待 mpe:init
      │
      ├──── 超时5s ──► 使用默认权限集
      │
      ▼
收到 mpe:init，配置权限与UI
      │
      ▼
回复 mpe:ready，握手完成
      │
      ▼
正常通信（loadPipeline / change / save ...）
      │
      ▼
宿主发送 mpe:destroy（可选）
      │
      ▼
MPE 清理资源，宿主销毁 iframe
```

---

## 8. 变更通知机制

MPE 在流程图发生变更时，主动向宿主推送 `mpe:change` 消息，使宿主可以：

- 实现"未保存变更"标记（VSCode 的文件 dirty 状态）
- 实时同步流程数据（如多端协作场景）
- 记录操作日志

变更类型：

| type          | 说明         | detail 示例                             |
| ------------- | ------------ | --------------------------------------- |
| `node.add`    | 添加节点     | `{ nodeId, taskName }`                  |
| `node.delete` | 删除节点     | `{ nodeId }`                            |
| `node.update` | 节点数据变更 | `{ nodeId, field, oldValue, newValue }` |
| `edge.add`    | 添加边       | `{ edgeId, source, target }`            |
| `edge.delete` | 删除边       | `{ edgeId }`                            |
| `layout`      | 布局变化     | `{ nodeCount, edgeCount }`              |

变更通知为**尽力交付**（best-effort），不做消息确认，宿主不应依赖其做精确的状态同步。需要精确状态时应使用 `mpe:save` 获取全量数据。

---

## 9. 安全考量

### 9.1 origin 校验

MPE 在接收 postMessage 时应校验 `event.origin`：

- 若 URL 参数携带 `origin`，仅接受匹配的 origin
- 若未携带 `origin`，接受所有 origin（开发便利性，生产环境建议携带）

### 9.2 消息协议标识

所有消息携带 `protocol: 'mpe-embed'`，MPE 仅处理符合协议标识的消息，忽略其他 postMessage（如浏览器扩展注入的消息）。

### 9.3 版本协商

握手时 MPE 在 `mpe:ready` 中声明自身支持的协议版本。若宿主请求的版本不被支持，MPE 应在 `mpe:ready` 中返回最低兼容版本，由宿主决定是否继续。

---

## 10. 协议版本

当前版本：**0.0.1**

版本策略遵循语义化版本：

- 主版本号变更：不兼容的协议变更（消息格式、握手流程等）
- 次版本号变更：向后兼容的功能新增（新增消息类型、新增 capability 字段）
- 修订号变更：向后兼容的问题修正

MPE 在 `mpe:ready` 中返回 `version` 字段，宿主据此判断兼容性。

---

## 11. 宿主侧集成示例

> 以下为伪代码，仅说明宿主侧的集成方式，不作为 MPE 实现的一部分。

```typescript
// VSCode 插件侧 WebView 集成示例

const panel = vscode.window.createWebviewPanel(
  "mpe-editor",
  "Pipeline Editor",
  vscode.ViewColumn.One,
  { enableScripts: true },
);

panel.webview.html = `
  <iframe
    id="mpe-frame"
    src="https://mpe.codax.site/stable/?embed=true&origin=vscode-maa"
    style="width:100%;height:100vh;border:none;"
  />
`;

// iframe 加载后发送握手
setTimeout(() => {
  panel.webview.postMessage({
    protocol: "mpe-embed",
    version: "0.0.1",
    type: "mpe:init",
    payload: {
      capabilities: {
        readOnly: false,
        allowCopy: true,
        allowUndoRedo: true,
        allowAutoLayout: true,
        allowAI: false,
        allowSearch: true,
        allowCustomTemplate: false,
      },
      ui: {
        hideHeader: true,
        hideToolbar: false,
        hiddenPanels: ["config", "local-file", "logger", "exploration"],
      },
    },
  });
}, 2000);

// 监听 MPE 消息
panel.webview.onDidReceiveMessage((msg) => {
  if (msg.protocol !== "mpe-embed") return;
  switch (msg.type) {
    case "mpe:ready":
      console.log("MPE ready, version:", msg.payload.version);
      break;
    case "mpe:change":
      updateDirtyState(true);
      break;
    case "mpe:saveData":
      writePipelineFile(msg.payload.fileName, msg.payload.data);
      break;
  }
});
```

---

## 12. 开放问题

### Q1：是否需要支持多文件（多个 pipeline JSON）的加载与切换？

**推荐方案：首期仅支持单文件，预留多文件扩展位。**

- 理由：多文件切换涉及 MPE 内部的文件树、标签页、跨文件引用等复杂状态管理，首期投入产出比低
- 做法：`mpe:loadPipeline` 当前仅支持单个文件；在消息格式中预留 `fileId` 字段（可选），首期忽略，后续需要时激活
- 宿主如需切换文件，可通过 `mpe:destroy` → 重建 iframe 的方式实现

### Q2：`mpe:change` 的粒度是否需要节流/防抖？

**推荐方案：MPE 侧内置防抖，默认 300ms，不可配置。**

- 理由：流程图编辑过程中单次操作可能触发数十次 `node.update`（拖拽、字段编辑），不做防抖会淹没宿主消息通道
- 300ms 对用户感知无影响，但能将高频操作合并为一次通知
- 防抖仅在 MPE 侧做（`EmbedBridge` 内部），不影响消息格式，宿主无需感知
- `detail` 在防抖窗口内取最终值（最新覆盖），不做增量合并

### Q3：是否需要支持 MPE 向宿主请求额外资源（如模板图片预览）？

**推荐方案：首期不支持，协议预留 `mpe:resourceRequest` 方向。**

- 理由：模板图片预览需要宿主实现文件服务，增加首期集成成本；且 MPE 在嵌入模式下可仅显示模板名称，不预览图片
- 做法：在 MPE → 宿主消息类型表中预留 `mpe:resourceRequest`（`{ type: 'image', path: string }`），MPE 首期不发送此消息
- 后续如需支持，宿主实现 `mpe:resourceResponse` 回传 base64 数据即可

### Q4：嵌入模式下是否需要 MPE 提供"关于/版本"入口？

**推荐方案：不需要独立 UI 入口，但 `mpe:ready` 中携带版本信息即可。**

- 理由：嵌入模式下 MPE 的 UI 受宿主控制，额外 UI 入口会破坏宿主的界面一致性
- `mpe:ready` 已返回 `version` 字段，宿主可自行在自身 UI 中展示版本信息
- 若用户主动查询，宿主可通过 `mpe:state`（`fields: ['version']`）获取

### Q5：VSCode WebView 的 postMessage 与 iframe 内 postMessage 的桥接方案？

**推荐方案：宿主侧注入中继脚本，MPE 侧无需改动。**

- 问题本质：VSCode WebView 的 `vscode.postMessage` 只能从 WebView 内部发往扩展进程，而 iframe 内的 `window.parent.postMessage` 发往的是 WebView 页面，无法直接到达扩展进程
- 解决方式：在 WebView 的 HTML 中（iframe 外层）注入一段简短的中继脚本，将 iframe 发来的 postMessage 转发给 `acquireVsCodeApi().postMessage`
- 中继脚本约 20 行，由宿主负责，MPE 侧代码完全不受影响
- MPE 使用标准的 `window.parent.postMessage` 即可，无需感知 VSCode 的存在

```javascript
// 宿主侧中继脚本示例（注入在 iframe 外层）
const vscode = acquireVsCodeApi();
window.addEventListener("message", (event) => {
  if (event.data?.protocol === "mpe-embed") {
    vscode.postMessage(event.data); // iframe → 扩展进程
  }
});
// 扩展进程 → iframe
// 在 onDidReceiveMessage 中：
// document.getElementById('mpe-frame').contentWindow.postMessage(msg, '*');
```
