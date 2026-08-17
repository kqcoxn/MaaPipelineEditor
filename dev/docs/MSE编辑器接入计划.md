# MSE 编辑器接入计划

## 文档状态

- 状态：第二版；MPE 侧已完成自动验证，待手动验收；MSE 侧待实施
- 目标版本：MPE v1.8.0 / 对应 MSE 版本待定
- 涉及项目：MaaPipelineEditor（MPE）、maa-support-extension（MSE）
- 首版定位：在 VS Code 中使用完整 MPE 编辑单个 MaaFramework Pipeline 文件，并由 MSE 写回原文件

## 背景与结论

MSE 已经提供 MaaFramework Pipeline 的解析、诊断、导航、工具和运行辅助能力，但缺少图形化编辑入口。MPE 已提供 iframe 嵌入模式和 `mpe-embed` v1.0.0 基础协议，可以由宿主加载 Pipeline 对象、接收变更通知并请求当前画布数据。

本次接入不是只读预览。用户从 MSE 打开某个 Pipeline 文件后，应直接进入保留 Header、工具栏、面板和画布的完整 MPE 编辑界面；用户主动保存时，MPE 将当前 Pipeline 交给 MSE，由 MSE 校验并写回原始文档。

当前具备开始实施的基础，但尚未达到可发布状态。现有协议的加载和取数链路可以复用，仍需补充嵌入态保存入口、保存结果回执、MSE 写回实现、嵌入态产品裁剪和真实 VS Code 验收。

## 产品目标

用户可以从以下三个入口使用 MPE 打开受 MSE 管理的 MaaFramework Pipeline 文件：

1. 编辑器标题栏按钮。
2. VS Code 文件资源管理器右键菜单。
3. JSON/JSONC 编辑器内容区域右键菜单。

打开后，用户可以使用 MPE 的全部编辑模块修改 Pipeline。MSE iframe 工具栏仅提供“保存到 MSE”和“从 MSE 同步”，同步操作用于请求重新读取当前 `TextDocument`。用户点击嵌入态专用的保存按钮或按 `Ctrl/Cmd+S` 后，由 MSE 将结果安全写回原文件。

## 首版范围

### 包含

- 三个“使用 MPE 打开”入口，共用同一命令和文件校验逻辑。
- 读取当前 `TextDocument` 的内存文本，因此可打开尚未保存的内容。
- 解析 JSON/JSONC 并加载到可编辑 MPE iframe。
- 一个文档 URI 对应一个 MPE 标签页；同一文件复用，不同文件可以并存。
- 保留 MPE Header、工具栏、画布、字段、连接、配置、搜索、错误和日志等模块。
- MSE iframe 模式隐藏手动导入和 JSON 预览，工具栏提供“保存到 MSE”与“从 MSE 同步”。
- iframe 模式将常规导出入口替换为单一“保存到 MSE”操作，不提供下载、剪贴板、LocalBridge 导出和部分导出。
- MPE 主动发起保存，MSE 获取画布数据后以最小 JSONC 编辑写回当前文档并保存到磁盘。
- 保存成功、失败和源文件冲突均回传 MPE，在界面内给出明确状态。
- 嵌入态跳过答题系统、使用协议确认和更新日志，握手及文件加载完成后直接可编辑。
- 小工具和调试服务模块保留；涉及设备、截图或 LocalBridge 的操作改为环境提示。
- MSE 嵌入态的 Star 提示同时展示 MPE 与 MSE 两个仓库及各自链接。

### 不包含

- 文本编辑器与 MPE 的逐次实时双向同步。
- 文本光标与 MPE 节点的双向定位。
- MPE 改动后自动写盘；必须由用户主动保存。
- 多文件合并编辑或跨文件节点关系。
- 在 iframe 内启动、连接或代理 LocalBridge。
- 在 iframe 内直接调用 MSE 小工具或调试命令。
- MAA Pipeline 兼容。
- `default_pipeline.json` 编辑。
- 离线内置 MPE 静态资源包。

## 支持文件判定

首版只对同时满足以下条件的文档开放入口：

1. 文档 scheme 为 `file`。
2. 扩展名为 `.json` 或 `.jsonc`。
3. 文件可由当前 MSE `InterfaceBundle.locateLayer` 定位到 Pipeline 资源层。
4. 定位结果不是 `default_pipeline.json`。
5. 当前不是 MaaAssistantArknights 模式。
6. 文件不位于以 `.` 开头的忽略目录中。

菜单 `when` 条件只负责减少无效入口，不能作为安全或正确性校验。命令执行时必须基于目标 URI 再次完成全部判定。

## 用户流程

### 打开

1. 用户从标题栏、资源管理器右键或编辑器行内右键执行“使用 MPE 打开”。
2. MSE 解析入口传入的 URI；没有 URI 时回退到当前活动编辑器。
3. MSE 校验文件类型和资源层，读取 `TextDocument.getText()` 并解析 JSONC。
4. MSE 创建或显示该 URI 对应的标签页，完成 iframe 握手后发送当前文档快照。
5. MPE 加载成功后直接显示完整编辑器，不出现协议、答题或更新日志阻断。

### 编辑与保存

1. 用户在 MPE 中编辑，MPE 通过 `mpe:change` 标记当前会话存在未保存修改；首次 `mpe:loadPipeline` 及宿主主动重新加载期间抑制变更通知，并在 `mpe:loadResult` 成功后建立 clean 基线。
2. 用户点击“保存到 MSE”或按 `Ctrl/Cmd+S`。
3. MPE 发送 `mpe:saveRequest`，MSE 随后发送 `mpe:save` 获取规范化 Pipeline 对象。
4. MSE 检查原文档版本，计算加载快照与新对象之间的结构差异。
5. 无冲突时，MSE 使用 `jsonc-parser` 生成最小文本编辑，通过 `WorkspaceEdit` 应用到 `TextDocument`，再调用 `document.save()` 写盘。
6. MSE 将保存结果回传 MPE；成功后更新会话基线并清除未保存状态，失败时保留编辑状态。

### 从 MSE 同步

1. 用户点击 iframe 工具栏中的“从 MSE 同步”。
2. 若 MPE 存在未保存修改，先提示同步会覆盖当前画布，并允许用户取消。
3. MPE 发送 `mpe:reloadRequest`，MSE 重新读取该标签页绑定 URI 对应的最新 `TextDocument.getText()`，而不是读取磁盘旧内容。
4. MSE 重新校验文件和解析 JSONC，成功后通过 `mpe:loadPipeline` 将最新内容发送给 MPE。
5. MPE 加载成功后重置 undo/redo 历史、dirty 状态和会话 clean 基线；MSE 同步更新原始文本、解析对象和文档版本。
6. 读取、解析或加载失败时保留当前画布及 dirty 状态，并在 MPE 内显示失败原因。

同步只在用户点击时发生，不自动跟随 `TextDocument` 修改。它既是主动刷新入口，也是保存遇到 `document_changed` 冲突后的标准恢复路径。

### 关闭

- 有未保存修改时，标签页关闭前应弹出“保存 / 不保存 / 取消”。
- WebviewPanel 销毁时清理消息监听、待处理请求、文档监听和实例注册。
- VS Code 或扩展宿主无法可靠拦截关闭的场景，需要在实现阶段验证；若平台限制无法保证拦截，至少依靠 Webview 序列化恢复未保存画布，并在发布说明中明确边界。

## 入口与标签页策略

### 菜单入口

- `editor/title`：当前受支持 Pipeline 的标题栏图标。
- `explorer/context`：右键受支持的 JSON/JSONC 文件。
- `editor/context`：在受支持的 JSON/JSONC 编辑器内容区域右键。
- 命令面板：保留相同命令，便于键盘调用和排错。

MSE 应维护类似 `maa.pipelineEditorAvailable` 的 context key 控制标题栏和编辑器菜单可见性。资源管理器菜单可以先按扩展名显示，执行时再做完整资源层校验。

### 标签页

- 一个文档 URI 对应一个编辑标签页。
- 同一文件重复打开时复用已有标签页，不覆盖其中尚未保存的 MPE 修改。
- 同一文件重复执行打开命令时只显示已有标签页，不隐式重新加载；需要刷新内容时使用“从 MSE 同步”。
- 不同文件可以同时打开各自标签页。
- 标题格式建议为 `MPE: <文件名>`；重名时补充工作区相对路径。
- 打开 MPE 时不替换原文本编辑器。

## 技术架构

```text
VS Code 文本编辑器 / 文件资源管理器
    │ 命令、TextDocument、WorkspaceEdit、document.save()
    ▼
MSE Extension Host
    │ MSE 类型化 Webview IPC
    ▼
MSE Pipeline Editor Webview
    │ mpe-embed / window.postMessage
    ▼
MPE iframe（可编辑嵌入模式）
```

采用专用 MSE Webview 页面承载 iframe，复用 MSE 现有 `WebviewPanelProvider`、Vite 多页面构建、开发态 iframe 转发和 CSP 注入机制。文件识别、并发控制和磁盘写入只存在于 Extension Host；桥接页面不持有文件系统权限。

## MPE 嵌入态设计

### 完整界面与启动旁路

- 初始化配置使用 `readOnly: false`。
- `hideHeader: false`、`hideToolbar: false`、`hiddenPanels: []`，不因 MSE 接入隐藏常规模块。
- 嵌入环境必须在应用初始化最早阶段跳过使用协议、答题系统、新手引导和更新日志检测。
- 嵌入环境不读取浏览器缓存中的上次 Pipeline，不处理分享链接或 URL 导入参数，不注册文件拖拽导入。
- MPE 在收到 `mpe:init` 和首次 `mpe:loadPipeline` 前显示受控加载状态，成功后直接可用。
- iframe 隐藏本地文件入口、文件 Tab 新增按钮，并将版本号显示为不可切换的静态文本。

### 同步与保存入口

- MSE iframe 隐藏 `ImportButton` 和 JSON 预览，显示无下拉菜单的“从 MSE 同步”按钮。
- 同步按钮只发送 `mpe:reloadRequest`，不直接访问文件系统。
- MPE 存在未保存修改时，同步前必须二次确认；取消后不得发送请求。
- 同步进行中禁止重复请求；失败时保留原画布，成功时以 MSE 返回内容建立新的 clean 基线。
- 分享链接启动导入和全局文件拖拽等非按钮入口是否在 iframe 开放不随本次变更扩大，首版保持禁用。
- iframe 模式不显示常规 `ExportButton` 菜单。
- 在原导出操作位置显示单一“保存到 MSE”按钮，使用保存图标和明确 Tooltip。
- 保存按钮只触发 `mpe:saveRequest`；MPE 不自行下载文件、不写浏览器文件系统。
- `Ctrl/Cmd+S` 与按钮执行完全相同的宿主保存流程。
- 保存期间按钮显示进行中并防止重复提交；成功后清除 dirty 状态，失败后保留 dirty 状态并显示原因。
- 选区右键菜单中的“部分导出”等旁路在 iframe 模式下隐藏。

### 小工具与调试服务

除被替换的导出具体行为外，其余模块和入口保持可见，以维持完整 MPE 的结构与可发现性。对于必须依赖截图、设备或 LocalBridge 的功能：

- 不在 iframe 内尝试连接 MPE LocalBridge。
- 用户触发时显示环境提示，说明可以直接使用 MSE 提供的对应小工具或调试能力。
- 提示的推荐操作为留在 MSE 使用对应能力；次要操作跳转到 MPE 快速开始文档。
- 不将功能伪装为可用状态，也不静默失败。

首版只做提示，不增加从 iframe 反向调用 VS Code 命令的通用协议。后续若希望一键跳转 MSE 工具，应另行设计受限的宿主动作白名单。

### Star 提示

- `mpe:init` 增加宿主信息：宿主标识、显示名称和仓库 URL。
- 当宿主标识为 MSE 时，Star 提示同时展示 MPE 与 MSE，分别提供仓库链接。
- MPE 仓库：`https://github.com/kqcoxn/MaaPipelineEditor`。
- MSE 仓库：`https://github.com/neko-para/maa-support-extension`。
- 提醒状态按项目分别记录，不能因用户已关闭 MPE 提醒而永久隐藏 MSE 提醒，反之亦然。
- 宿主提供的 URL 仅接受 `https:`，显示名称按纯文本处理。

## 嵌入协议调整

现有 `mpe:init`、`mpe:ready`、`mpe:loadPipeline`、`mpe:loadResult`、`mpe:change`、`mpe:saveRequest`、`mpe:save` 和 `mpe:saveData` 可以复用。保存反馈与 iframe 主动同步由 v1.1.0 补齐，v1.2.0 新增宿主外链代理，v1.4.0 新增宿主节点导航与 Anchor 定义清单；这些变更均保持 1.x 主版本兼容。

### 初始化扩展

```json
{
  "capabilities": {
    "readOnly": false,
    "allowCopy": true,
    "allowUndoRedo": true,
    "allowAutoLayout": true,
    "allowSearch": true,
    "allowCustomTemplate": true,
    "hostNodeNavigation": true
  },
  "ui": {
    "hideHeader": false,
    "hideToolbar": false,
    "hiddenPanels": []
  },
  "host": {
    "id": "mse",
    "name": "Maa Support Extension",
    "repositoryUrl": "https://github.com/neko-para/maa-support-extension"
  }
}
```

### 保存结果

新增宿主到 MPE 的 `mpe:saveResult`：

```json
{
  "success": true,
  "documentVersion": 42
}
```

失败时返回稳定错误码和可展示消息，例如 `document_changed`、`apply_edit_failed`、`save_failed`、`invalid_pipeline`。保存链路中的所有请求使用 `requestId` 关联，超时后进入失败状态，不清除 dirty 标记。

### 同步请求

新增 MPE 到宿主的 `mpe:reloadRequest`。MSE 收到后读取当前 `TextDocument`，解析成功则使用相同 `requestId` 复用 `mpe:loadPipeline` / `mpe:loadResult` 完成加载；读取或解析失败则发送带相同 `requestId` 的 `mpe:error`。MPE 只在 `mpe:loadResult.success` 为 true 后替换会话基线并清除 dirty。

新增 MPE 到宿主的 `mpe:openExternalRequest`。MSE 收到后必须重新解析并校验 `payload.url`，只接受 `http:` / `https:`，再调用 `vscode.env.openExternal(vscode.Uri.parse(url))`。MPE iframe 内的文档、仓库和帮助链接统一走该消息，不能依赖 Webview 中可能被拦截的 `window.open`。

### 节点导航与 Anchor 定义

v1.4.0 新增 `hostNodeNavigation` 能力。MSE 设置为 `true` 后，MPE iframe 中的 External 节点通过 `mpe:navigateNodeRequest` 请求 MSE 在当前资源内查找、打开并定位节点；MSE 使用相同 `requestId` 返回 `mpe:navigateNodeResult`。MPE 不执行本地节点搜索、LocalBridge 查询或失败回退。

`mpe:loadPipeline.payload.anchorDefinitions` 来自 `InterfaceBundle.topLayer.getAnchorList()`，其中 `belong` 映射为定义 Anchor 的 `nodeName`。MPE 以当前画布的 `anchorReferenceIndex` 作为当前文件实时结果，仅补充 `isCurrentFile === false` 的跨文件记录并按文件、节点去重。iframe 中 Anchor 定义列表只读，不发送导航请求。

### 消息时序

```text
打开文件
  MSE Host → Webview → MPE：mpe:init
  MPE → Webview → MSE Host：mpe:ready
  MSE Host → Webview → MPE：mpe:loadPipeline
  MPE → Webview → MSE Host：mpe:loadResult

编辑并保存
  MPE → Webview → MSE Host：mpe:saveRequest
  MSE Host → Webview → MPE：mpe:save
  MPE → Webview → MSE Host：mpe:saveData
  MSE Host：校验版本、生成最小编辑、应用并保存
  MSE Host → Webview → MPE：mpe:saveResult

从 MSE 同步
  MPE → Webview → MSE Host：mpe:reloadRequest
  MSE Host：读取最新 TextDocument 并解析 JSONC
  MSE Host → Webview → MPE：mpe:loadPipeline
  MPE → Webview → MSE Host：mpe:loadResult
```

桥接页面只接受来自当前 iframe `contentWindow` 且 origin 等于 MPE URL origin 的消息；向 iframe 发送消息时使用精确 origin，不使用 `*`。

## MSE 改动计划

### 命令与服务

- 在 `pkgs/extension/src/command.ts` 增加统一命令，例如 `maa.open-pipeline-editor`。
- 在 `release/package.json` 注册命令、`editor/title`、`explorer/context` 和 `editor/context` 菜单。
- 在中英文 `package.nls` 文件增加命令名称、保存状态和错误文案。
- 新增负责 context key、命令、文档监听和标签页注册表的 `PipelineEditorService`。
- 在 `pkgs/extension/src/service/index.ts` 注册并初始化该服务。

### 文档读取与会话基线

- 使用命令目标 URI 获取或打开 `TextDocument`，不能始终依赖活动编辑器。
- 使用 `jsonc-parser` 解析 JSON/JSONC，要求根值为对象；空文件可按空对象处理。
- 保存会话基线：文档 URI、加载时版本、原始文本、解析对象和最近一次成功保存对象。
- 收到 `mpe:reloadRequest` 时重新读取绑定 URI 的 `TextDocument`，不能使用打开标签页时缓存的文本。
- 使用 `InterfaceBundle.locateLayer` 验证文件属于 Pipeline 资源。
- 解析错误时显示第一个错误的位置和简洁说明，不创建空白编辑页。

### Webview 标签页

- 新增 `WebviewPipelineEditorPanel`，按 URI 管理实例。
- 新增 `pipeline-editor.html` 和对应 Vue/TypeScript 入口。
- 将页面加入 `pkgs/webview/vite.config.mts` 多页面构建输入。
- 在 `@nekosu/maa-types` 中增加 Extension Host 与 Webview 的消息类型。
- 页面只负责全尺寸 iframe、加载/保存/错误遮罩和协议转发，不复制 MPE 内部工具栏。

### JSONC 保真写回

MSE 不得对 MPE 返回对象直接执行 `JSON.stringify` 后整文件覆盖。写回流程必须满足：

- 比较会话基线对象与 MPE 返回对象，形成按 JSON path 表达的新增、删除和修改集合。
- 使用 `jsonc-parser.modify` 与 `applyEdits` 对当前文本生成最小编辑，保留未修改区域的注释、字段顺序、缩进和换行风格。
- 对数组尽量应用元素级差异；只有整个数组语义确实改变且无法稳定映射时才替换该数组值。
- 删除节点或字段时允许一并删除其附属注释；未涉及路径上的注释不得丢失。
- 生成结果后再次解析，并校验其对象语义与 MPE 返回结果一致，再应用 `WorkspaceEdit`。
- `WorkspaceEdit` 成功后调用 `document.save()`；只有磁盘保存成功才向 MPE 返回成功。

### 并发与冲突

- 加载后监听对应 `TextDocument` 版本变化。
- MPE 自身发起的 `WorkspaceEdit` 需标记，避免被误判为外部冲突。
- 若保存前文档版本已偏离会话基线，首版拒绝写回并返回 `document_changed`，不得静默覆盖文本侧修改。
- 冲突提示提供“从 MSE 同步”和“返回继续编辑”；首版不自动做三方合并。
- 重新加载会覆盖 MPE 未保存内容，必须二次确认。
- 保存成功后，以保存后的文本、对象和文档版本更新会话基线。

## 配置与安全

- 新增 `maa.pipelineEditorUrl`，默认建议为 `https://mpe.codax.site/stable/`。
- 允许开发者配置本地或自部署地址，用于联调和网络受限环境。
- 生产 Webview CSP 的 `frame-src` 仅允许配置得到的 HTTP(S) origin。
- 协议按主版本兼容，首版接受 `1.x`；保存结果能力通过协商或版本检测启用。
- 不向 MPE 发送文件绝对路径，只发送展示文件名、Pipeline 对象和必要会话标识。
- iframe 不能指定任意磁盘目标；所有保存都绑定打开时的文档 URI。
- Extension Host 在每次保存时重新校验 URI、文档状态和 Pipeline 根对象。

## 错误与状态设计

编辑页需要覆盖以下状态：

- 正在加载 iframe。
- 正在握手并等待协议就绪。
- 正在加载 Pipeline。
- 正在从 MSE 同步。
- 已就绪，存在或不存在未保存修改。
- 正在保存。
- 保存成功。
- 错误，可重试或返回编辑。

错误至少包括：文件不受支持、JSONC 解析失败、MPE URL 无效、iframe 加载或握手超时、协议版本不兼容、Pipeline 加载失败、源文档已修改、最小编辑生成失败、`WorkspaceEdit` 失败和磁盘保存失败。

## 测试计划

### MPE 自动测试

- 嵌入态跳过协议确认、答题、新手引导和更新日志。
- 嵌入态保留 Header、工具栏和全部面板。
- 嵌入态保留现有 ImportButton 及其菜单，并在旁边显示独立的“从 MSE 同步”按钮。
- 手动导入后保存仍写回标签页最初绑定的文档 URI，导入文件名不能改变写回目标。
- iframe 不响应全局文件拖拽和 URL 启动导入等非按钮旁路。
- 同步无 dirty 时直接请求；有 dirty 时确认后请求，取消不发送消息。
- 同步成功替换画布并重置历史与 dirty，读取、解析或加载失败保留原画布。
- 嵌入态只显示“保存到 MSE”，常规导出与部分导出不可用。
- 点击保存和 `Ctrl/Cmd+S` 均发送一次 `mpe:saveRequest`。
- 首次加载和宿主重新加载不会触发 dirty 状态，用户实际编辑后才触发。
- 保存进行中防重复提交；`mpe:saveResult` 正确更新成功、失败和 dirty 状态。
- 小工具和调试服务在嵌入态显示正确环境提示。
- MSE 宿主信息使 Star 提示同时展示两个仓库链接。

### MSE 自动测试

- 三种入口对 URI 的解析一致，命令执行时均重新校验文件。
- 支持文件判定覆盖 JSON、JSONC、隐藏目录、`default_pipeline.json`、MAA 模式和非 Pipeline 文件。
- JSONC 解析覆盖注释、尾逗号、空文件和非法文本。
- 同一 URI 复用标签页，不同 URI 创建不同标签页。
- 同一标签页有未保存修改时不会被重复打开命令静默覆盖。
- `mpe:reloadRequest` 始终读取绑定 URI 的最新 `TextDocument`，并回传对应请求结果。
- 同步成功更新会话版本基线；同步解析失败不修改基线。
- JSONC 最小写回保留未修改路径的注释、字段顺序、缩进和换行。
- 新增、删除、重命名节点以及嵌套字段、数组修改后语义与 MPE 输出一致。
- 文档版本变化时拒绝覆盖并返回 `document_changed`。
- `WorkspaceEdit` 或 `document.save()` 失败时 MPE 保持 dirty。
- iframe reload 后旧请求失效并重新握手。
- 来源窗口或 origin 不匹配的消息被忽略。
- 标签页销毁后从实例注册表移除。

### 手动验收

- 从标题栏、资源管理器右键和编辑器行内右键均可打开正确文件。
- 已保存 JSON、带注释和尾逗号的 JSONC、尚未保存的文档均可加载。
- 可以新增、删除、连接、重命名和编辑节点，并保存回原文件。
- 保存后 VS Code 文本编辑器内容、磁盘文件和重新加载后的 MPE 语义一致。
- 未修改区域的 JSONC 注释、字段顺序和格式保持不变。
- 文本编辑器在 MPE 打开后发生修改时，MPE 保存不会覆盖该修改。
- MPE 页面不出现答题、协议确认或更新日志，Header 和各模块正常显示。
- MSE iframe 内隐藏手动导入、JSON 预览、下载导出、剪贴板导出和部分导出入口。
- 手动导入另一份 Pipeline 后，“保存到 MSE”仍写回原标签页绑定的 `TextDocument`。
- 修改文本编辑器后点击“从 MSE 同步”，画布更新为最新 `TextDocument` 内容。
- MPE 有未保存修改时同步会要求确认；取消或同步失败不会丢失当前画布。
- 小工具和调试服务优先提示留在 MSE 使用对应能力，并提供 MPE 快速开始文档入口。
- Star 提示包含 MPE、MSE 名称和两个正确仓库链接。
- 两个同名但路径不同的文件可以同时编辑且不会串写。
- 网络、协议、解析和写盘失败均有明确反馈，未保存内容不会被误标为已保存。

按照项目约定，前端实现完成后不自动启动开发服务器或浏览器测试，由维护者执行以上手动验收。

## 实施阶段

### 阶段一：MPE 嵌入态产品收口

状态：已完成自动测试、静态检查和生产构建，待维护者手动验收。

- 跳过阻断弹窗，保留完整编辑界面。
- 保留嵌入态 ImportButton，在旁边新增“从 MSE 同步”，并确保两者不会改变标签页绑定 URI。
- 将导出区替换为宿主保存按钮，接入 dirty 与保存结果状态。
- 为小工具、调试服务和双仓库 Star 提示增加嵌入态分支。
- 补充 MPE 自动测试和 iframe 测试宿主能力。

完成标准：测试宿主可以加载、同步、编辑、请求保存并反馈结果；手动导入只影响画布，文档同步和持久化均通过宿主完成。

### 阶段二：MSE 三入口与标签页骨架

- 注册命令、三个菜单入口、国际化文案和配置项。
- 实现文件判定、文档读取、JSONC 解析和会话基线。
- 实现按 URI 管理的 WebviewPanel。

完成标准：三个入口均能打开正确文件，重复打开和多标签页行为符合计划。

### 阶段三：保存协议与 JSONC 写回

- 完成握手、加载、同步、变更、保存、超时和 origin 校验。
- 实现 JSON path 差异、最小编辑、语义复验、`WorkspaceEdit` 和磁盘保存。
- 实现文档版本冲突检测、重新加载和保存结果回传。

完成标准：常见 JSON/JSONC Pipeline 可以往返编辑，未修改内容保持格式，冲突不会静默覆盖。

### 阶段四：验收与发布

- 完成两端自动测试和 MSE Webview 手动测试。
- 更新 MPE 嵌入协议文档、MSE 功能文档、配置说明和发布说明。
- 在 MSE 中以普通功能发布，不替换原文本编辑器。

完成标准：全部首版验收项通过，MPE 稳定版已部署 v1.1 保存反馈能力，MSE 默认 URL 指向该版本。

## 准备度评估

| 能力 | 当前状态 | 对首版的影响 |
| --- | --- | --- |
| MPE iframe 握手与生命周期 | 已完成 v1.1 扩展 | 已增加同主版本校验和操作清理 |
| MPE Pipeline 对象加载与编辑 | 已具备 | 核心编辑能力无需重做 |
| MPE 变更通知与画布取数 | 已完成 | 基于导出结果与 clean 基线判断 dirty |
| MPE 嵌入态宿主保存按钮 | 已完成 | 等待 MSE 实现写回和结果回执 |
| MPE 从 MSE 同步按钮 | 已完成 | 等待 MSE 响应 reloadRequest |
| MPE 保存结果与 dirty 状态 | 已完成 | 已通过 v1.1.0 补齐 |
| MPE 嵌入态导入与同步边界 | 已完成 | MSE 下隐藏手动导入与 JSON 预览，保留同步并固定宿主写回语义 |
| MPE 嵌入态外链代理 | MPE 侧已完成 | 等待 MSE 处理 `mpe:openExternalRequest` 并调用 `vscode.env.openExternal` |
| MPE External 宿主导航 | MPE 侧已完成 v1.4.0 | MSE 声明能力后处理请求/结果并负责跨文件定位 |
| MPE Anchor 跨文件定义 | MPE 侧已完成 v1.4.0 | MSE 从 topLayer Anchor 列表提供定义，iframe 列表只读 |
| MPE 小工具/调试环境提示 | 已完成 | 已覆盖 Header、工具箱、字段快捷工具和节点调试入口 |
| MPE 双仓库 Star 提示 | 已完成 | 由 MSE host 元数据启用 |
| MSE WebviewPanel 与外部 iframe 基础 | 已具备 | 可复用现有 Provider 和 CSP 方案 |
| MSE Pipeline 文件识别与 JSONC 解析 | 已具备基础 | 需要封装为统一入口 |
| MSE 三菜单入口与编辑标签页 | 尚未实现 | 首版主要开发内容 |
| MSE JSONC 保真写回与冲突控制 | 尚未实现 | 首版最高风险工作 |
| VS Code 真实环境端到端验证 | 尚未完成 | 发布前必须完成 |

结论：MPE 侧接入能力已经完成自动验证，可以进入 MSE 实施和两端联调，但整体功能仍未达到可发布状态。剩余主要技术风险集中在 MSE 的 JSONC 保真写回、文档并发冲突、Webview 关闭时的未保存保护和真实 VS Code 环境验收。

## 待确认决策

以下内容已按本轮反馈确定：

1. 首版具备编辑和写回能力，不做只读预览。
2. 提供标题栏、资源管理器右键、编辑器行内右键和命令面板入口。
3. 嵌入态跳过答题、协议确认和更新日志，打开后直接可用。
4. 保留 Header 和全部模块；LocalBridge 相关能力提供 MSE / 独立 MPE 使用提示。
5. MSE 嵌入态同时提供 MPE 与 MSE 的 Star 提示和仓库链接。
6. MSE iframe 隐藏手动导入和 JSON 预览，仅保留“保存到 MSE”与“从 MSE 同步”，同步时由 MSE 重新读取当前 `TextDocument`。

仍建议确认以下默认决策：

1. 首版只支持 MaaFramework Pipeline，继续排除 MAA 和 `default_pipeline.json`。
2. 保存时若文本侧自加载后发生变化，首版直接拒绝写回并要求重新加载，不实现自动三方合并。
3. 保存操作通过 `WorkspaceEdit` 更新当前文档后立即调用 `document.save()` 写入磁盘，而不是只保留为 VS Code 未保存修改。
4. 标签页按文档 URI 复用，不同文件允许并存。
5. MPE URL 可配置，默认使用官方稳定版地址。
