# LocalBridge 通信协议

<cite>
**本文引用的文件**
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md)
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go)
- [LocalBridge/config/default.json](file://LocalBridge/config/default.json)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go)
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go)
- [LocalBridge/internal/server/websocket.go](file://LocalBridge/internal/server/websocket.go)
- [LocalBridge/internal/service/file/file_service.go](file://LocalBridge/internal/service/file/file_service.go)
- [LocalBridge/internal/protocol/file/file_handler.go](file://LocalBridge/internal/protocol/file/file_handler.go)
- [LocalBridge/pkg/models/message.go](file://LocalBridge/pkg/models/message.go)
- [LocalBridge/pkg/models/file.go](file://LocalBridge/pkg/models/file.go)
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md)
- [src/services/server.ts](file://src/services/server.ts)
- [src/services/requests.ts](file://src/services/requests.ts)
- [src/services/responds.ts](file://src/services/responds.ts)
- [src/services/type.ts](file://src/services/type.ts)
- [src/services/index.ts](file://src/services/index.ts)
- [src/main.tsx](file://src/main.tsx)
- [src/stores/fileStore.ts](file://src/stores/fileStore.ts)
</cite>

## 更新摘要
**变更内容**
- 新增了对 `pkg/models` 包中定义的 WebSocket 消息类型（`Message`, `ErrorData`, `FileListData` 等）和文件模型（`File`, `FileInfo`）的详细说明。
- 更新了“文件服务”和“协议处理器”章节，以反映 `file_handler.go` 中将连接建立事件（`EventConnectionEstablished`）和文件变更事件（`EventFileChanged`）分开处理的最新实现。
- 修正了“架构总览”中的序列图，以准确展示事件总线的两种不同订阅逻辑。
- 更新了“详细组件分析”中“协议处理器”的流程图，以反映其事件订阅的分离逻辑。

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文档系统性梳理 LocalBridge（简称 LB）通信协议，覆盖连接管理、消息规范、文件协议、日志协议、事件总线、配置系统、CLI 应用以及前端 WebSocket 服务端实现。文档结合仓库内的协议说明、开发文档与前端实现，帮助开发者理解并正确集成本地服务与前端编辑器之间的双向通信。新增了对配置加载、日志系统、事件总线、文件扫描与监听等核心模块的详细说明。

**Section sources**
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L1-L191)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L1-L178)

## 项目结构
围绕 LocalBridge 通信协议的相关文件分布如下：
- 协议说明：LocalBridge/README/Agreement.md（本地文件协议、日志协议、WebSocket API 路由）
- 开发文档：LocalBridge/DEVELOPMENT.md（分层架构、模块化组件、构建运行）
- 配置文件：LocalBridge/config/default.json（默认配置）
- 配置系统：LocalBridge/internal/config/config.go（配置加载与解析）
- CLI 入口：LocalBridge/cmd/lb/main.go（应用生命周期管理）
- 日志系统：LocalBridge/internal/logger/logger.go（日志初始化与推送）
- 事件总线：LocalBridge/internal/eventbus/eventbus.go（模块间通信）
- 指南文档：docsite/docs/01.指南/10.其他/10.通信协议.md（MPE 侧通信协议与示例）
- 前端 WebSocket 服务端：src/services/server.ts（连接、消息路由、发送、状态管理）
- 前端请求封装：src/services/requests.ts（主动发送 Pipeline）
- 前端响应路由：src/services/responds.ts（接收服务端 Pipeline 并导入编辑器）
- 类型定义：src/services/type.ts（消息处理器与路由接口）
- 服务导出入口：src/services/index.ts
- 应用初始化：src/main.tsx（注册响应路由与初始化）
- 文件状态管理：src/stores/fileStore.ts（文件标签页与路径配置）

```mermaid
graph TB
subgraph "前端"
MAIN["应用入口<br/>src/main.tsx"]
SERVER["WebSocket 服务端<br/>src/services/server.ts"]
REQ["请求封装<br/>src/services/requests.ts"]
RESP["响应路由<br/>src/services/responds.ts"]
STORE["文件状态<br/>src/stores/fileStore.ts"]
end
subgraph "本地服务"
CLI["CLI 应用<br/>cmd/lb/main.go"]
CONF["配置系统<br/>internal/config/config.go"]
LOG["日志系统<br/>internal/logger/logger.go"]
EVENT["事件总线<br/>internal/eventbus/eventbus.go"]
FILE["文件服务<br/>service/file"]
PROTO["协议处理器<br/>protocol/file"]
WS["WebSocket 服务器<br/>server"]
end
subgraph "协议与指南"
AG["协议说明<br/>LocalBridge/README/Agreement.md"]
DEV["开发文档<br/>LocalBridge/DEVELOPMENT.md"]
DOC["指南文档<br/>docsite/docs/01.指南/10.其他/10.通信协议.md"]
end
CLI --> CONF
CLI --> LOG
CLI --> EVENT
CLI --> FILE
CLI --> PROTO
CLI --> WS
CONF --> AG
LOG --> DEV
EVENT --> FILE
EVENT --> WS
WS --> PROTO
PROTO --> FILE
MAIN --> RESP
MAIN --> SERVER
REQ --> SERVER
RESP --> STORE
SERVER --> AG
SERVER --> DOC
```

**Diagram sources**
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L1-L128)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go#L1-L157)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L1-L127)
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go#L1-L81)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L1-L191)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L1-L178)
- [src/main.tsx](file://src/main.tsx#L1-L23)
- [src/services/server.ts](file://src/services/server.ts#L1-L214)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/stores/fileStore.ts](file://src/stores/fileStore.ts#L1-L255)

## 核心组件
- **CLI 应用 (main.go)**
  - 作为应用入口，负责解析命令行参数、加载配置、初始化日志、事件总线、文件服务、WebSocket 服务器等核心组件。
  - 实现优雅退出，监听中断信号。
- **配置系统 (config.go)**
  - 支持从配置文件（default.json）和命令行参数加载配置。
  - 提供默认值、路径规范化、配置覆盖等功能。
  - 配置项包括服务器端口、文件根目录、排除列表、日志级别与目录、日志推送开关等。
- **日志系统 (logger.go)**
  - 基于 logrus 实现，支持分级输出（DEBUG, INFO, WARN, ERROR）。
  - 可同时输出到控制台和文件（按日期命名）。
  - 支持通过 `push_to_client` 配置项将日志推送到前端客户端。
- **事件总线 (eventbus.go)**
  - 基于发布-订阅模式，实现模块间解耦。
  - 提供全局事件总线实例，支持同步和异步发布事件。
  - 定义了文件扫描完成、文件变更、连接建立/关闭等事件类型。
- **文件服务 (file_service.go, scanner.go, watcher.go)**
  - **文件扫描**: 递归扫描根目录，支持 .json 和 .jsonc 文件，可配置排除目录，构建文件索引。
  - **文件监听**: 基于 fsnotify 实现，监听文件的创建、修改、删除事件，包含防抖处理。
  - 通过事件总线通知其他模块文件变更。
- **协议处理器 (file_handler.go)**
  - 实现文件相关协议（/etl/open_file, /etl/save_file 等）的处理逻辑。
  - 作为路由分发器的处理器，接收消息并调用文件服务。
- **WebSocket 服务器 (websocket.go)**
  - 基于 gorilla/websocket 实现，管理连接、消息收发。
  - 与路由分发器集成，将收到的消息分发给对应的协议处理器。
  - 支持广播和单播消息发送。

**Section sources**
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L1-L128)
- [LocalBridge/config/default.json](file://LocalBridge/config/default.json#L1-L29)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go#L1-L157)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L1-L127)
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go#L1-L81)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L1-L178)

## 架构总览
LocalBridge 通信架构以 WebSocket 为基础，采用分层设计，各模块通过事件总线解耦。CLI 应用作为入口，协调配置、日志、事件总线、文件服务和 WebSocket 服务器的初始化。文件服务负责文件的扫描、监听和操作，并通过事件总线通知 WebSocket 服务器推送文件列表或变更通知。前端通过 WebSocket 与本地服务进行双向通信。

```mermaid
sequenceDiagram
participant CLI as "CLI 应用<br/>main.go"
participant CONF as "配置系统<br/>config.go"
participant LOG as "日志系统<br/>logger.go"
participant EVENT as "事件总线<br/>eventbus.go"
participant FILE as "文件服务<br/>file_service.go"
participant WS as "WebSocket 服务器<br/>websocket.go"
participant MPE as "前端编辑器"
CLI->>CONF : Load(configPath)
CONF-->>CLI : 返回 Config
CLI->>LOG : Init(cfg.Log.Level, cfg.Log.Dir, cfg.Log.PushToClient)
CLI->>EVENT : GetGlobalBus()
CLI->>FILE : NewService(cfg.File.Root, ..., eventBus)
FILE->>EVENT : Subscribe(EventFileScanCompleted)
FILE->>EVENT : PublishAsync(EventFileScanCompleted)
CLI->>WS : NewWebSocketServer(..., eventBus)
WS->>EVENT : Subscribe(EventFileScanCompleted)
EVENT-->>WS : 通知扫描完成
WS->>MPE : 推送 /lte/file_list
MPE->>WS : 发送 /etl/open_file
WS->>FILE : 调用 OpenFile
FILE-->>WS : 返回文件内容
WS->>MPE : 推送 /lte/file_content
```

**Diagram sources**
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L52-L127)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go#L49-L87)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L22-L65)
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go#L70-L81)
- [LocalBridge/internal/service/file/file_service.go](file://LocalBridge/internal/service/file/file_service.go#L77-L89)
- [LocalBridge/internal/server/websocket.go](file://LocalBridge/internal/server/websocket.go#L95-L105)

## 详细组件分析

### CLI 应用 (main.go)
- **初始化流程**
  1. 解析命令行参数（--config, --root, --port, --log-dir, --log-level）。
  2. 加载配置（优先级：命令行 > 配置文件 > 默认值）。
  3. 初始化日志系统。
  4. 创建全局事件总线。
  5. 创建文件服务并启动（执行扫描和监听）。
  6. 创建 WebSocket 服务器和路由分发器。
  7. 注册文件协议处理器。
  8. 启动 WebSocket 服务器（goroutine）。
  9. 监听退出信号，执行优雅关闭。
- **依赖注入**
  - 通过构造函数将配置、事件总线、WebSocket 服务器等依赖注入到各模块。

```mermaid
flowchart TD
Start["开始"] --> ParseArgs["解析命令行参数"]
ParseArgs --> LoadConfig["加载配置"]
LoadConfig --> InitLogger["初始化日志系统"]
InitLogger --> CreateEventBus["创建事件总线"]
CreateEventBus --> CreateFileService["创建文件服务"]
CreateFileService --> StartFileService["启动文件服务"]
StartFileService --> CreateWSServer["创建 WebSocket 服务器"]
CreateWSServer --> CreateRouter["创建路由分发器"]
CreateRouter --> RegisterHandler["注册协议处理器"]
RegisterHandler --> SetMsgHandler["设置消息处理器"]
SetMsgHandler --> StartWSServer["启动 WebSocket 服务器 (goroutine)"]
StartWSServer --> WaitForSignal["等待退出信号"]
WaitForSignal --> GracefulShutdown["优雅关闭"]
GracefulShutdown --> StopWSServer["停止 WebSocket 服务器"]
StopWSServer --> StopFileService["停止文件服务"]
StopFileService --> LogExit["记录退出日志"]
LogExit --> End["结束"]
```

**Diagram sources**
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L52-L127)

**Section sources**
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L1-L128)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L66-L170)

### 配置系统 (config.go)
- **配置加载**
  - 使用 viper 库，支持 JSON 配置文件。
  - 查找路径：`./config/default.json` 或 `./default.json`。
  - 未找到配置文件时使用默认值。
- **配置结构**
  ```go
  type Config struct {
    Server ServerConfig `mapstructure:"server"`
    File   FileConfig   `mapstructure:"file"`
    Log    LogConfig    `mapstructure:"log"`
    MaaFW  MaaFWConfig  `mapstructure:"maafw"`
  }
  ```
- **路径规范化**
  - 将相对路径转换为绝对路径。
  - 验证根目录是否存在。
- **命令行覆盖**
  - `OverrideFromFlags` 方法允许命令行参数覆盖配置文件中的值。

**Section sources**
- [LocalBridge/config/default.json](file://LocalBridge/config/default.json#L1-L29)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go#L1-L157)

### 日志系统 (logger.go)
- **初始化**
  - 设置日志级别（从配置读取）。
  - 创建日志目录和按日期命名的日志文件。
  - 使用 `io.MultiWriter` 同时输出到控制台和文件。
- **日志推送**
  - 当 `cfg.Log.PushToClient` 为 true 时，添加 `PushHook`。
  - `PushHook` 在记录 INFO、WARN、ERROR 级别日志时，通过 `LogPushFunc` 回调将日志推送到 WebSocket 客户端。
- **便捷方法**
  - 提供 `Info`, `Warn`, `Error`, `Debug` 等全局函数，支持模块名和格式化输出。

**Section sources**
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L1-L127)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go#L24-L29)

### 事件总线 (eventbus.go)
- **核心功能**
  - `Subscribe`: 订阅特定类型的事件。
  - `Publish`: 同步发布事件，调用所有订阅者的处理函数。
  - `PublishAsync`: 异步发布事件（启动 goroutine）。
- **全局实例**
  - `globalBus` 为单例，通过 `GetGlobalBus()` 获取。
- **事件类型**
  - `EventFileScanCompleted`: 文件扫描完成。
  - `EventFileChanged`: 文件内容变更。
  - `EventConnectionEstablished`: 连接建立。
  - `EventConnectionClosed`: 连接关闭。

**Section sources**
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go#L1-L81)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L19-L20)

### 文件服务 (file_service.go, scanner.go, watcher.go)
- **文件扫描 (scanner.go)**
  - 递归遍历根目录，过滤指定扩展名（.json, .jsonc）和排除目录。
  - 构建 `[]File` 列表，包含文件路径、名称、相对路径。
  - 扫描完成后通过事件总线发布 `EventFileScanCompleted` 事件。
- **文件监听 (watcher.go)**
  - 使用 `fsnotify.Watcher` 监听根目录及其子目录。
  - 对 `Create`, `Write`, `Remove` 事件进行防抖（300ms 窗口期）。
  - 事件触发后发布 `EventFileChanged` 事件。
- **文件操作**
  - 提供 `OpenFile`, `SaveFile`, `CreateFile` 等方法，封装 JSON 读写和路径安全验证。

**Section sources**
- [LocalBridge/internal/service/file/file_service.go](file://LocalBridge/internal/service/file/file_service.go#L1-L200)
- [LocalBridge/internal/service/file/scanner.go](file://LocalBridge/internal/service/file/scanner.go#L1-L100)
- [LocalBridge/internal/service/file/watcher.go](file://LocalBridge/internal/service/file/watcher.go#L1-L100)
- [LocalBridge/DEVELOPMENT.md](file://LocalBridge/DEVELOPMENT.md#L24-L43)

### 协议处理器 (file_handler.go)
- **核心功能**
  - 实现 `/etl/open_file`, `/etl/save_file`, `/etl/create_file` 等文件操作协议。
  - 作为路由分发器的处理器，接收消息并调用文件服务。
- **事件订阅逻辑**
  - **连接建立事件**: 订阅 `EventConnectionEstablished` 事件，当有新客户端连接时，立即推送当前的文件列表（`/lte/file_list`）。
  - **文件变更事件**: 订阅 `EventFileChanged` 事件，当文件被创建、修改或删除时，向所有客户端广播文件变化通知（`/lte/file_changed`）。
  - 这种分离的订阅逻辑确保了文件列表的推送与文件变更通知的推送是独立且互不干扰的。

```mermaid
flowchart TD
A["NewHandler"] --> B["subscribeEvents"]
B --> C["订阅 EventConnectionEstablished"]
C --> D["连接建立时\n推送 /lte/file_list"]
B --> E["订阅 EventFileChanged"]
E --> F["文件变更时\n广播 /lte/file_changed"]
```

**Section sources**
- [LocalBridge/internal/protocol/file/file_handler.go](file://LocalBridge/internal/protocol/file/file_handler.go#L1-L213)
- [LocalBridge/internal/eventbus/eventbus.go](file://LocalBridge/internal/eventbus/eventbus.go#L77-L78)

### 消息与数据模型 (pkg/models)
- **WebSocket 消息结构**
  - 所有消息均采用统一的 `Message` 结构，包含 `path` (路由) 和 `data` (数据) 两个字段。
  - **Message**: `{ path: string, data: any }`
- **核心数据模型**
  - **ErrorData**: 错误消息，包含 `code` (错误码), `message` (描述), `detail` (可选详情)。
  - **FileInfo**: 文件基本信息，包含 `file_path` (绝对路径), `file_name` (文件名), `relative_path` (相对路径)。
  - **FileListData**: 文件列表数据，包含 `root` (根目录) 和 `files` (FileInfo 数组)。
  - **FileContentData**: 文件内容数据，包含 `file_path` 和 `content` (JSON 对象)。
  - **FileChangedData**: 文件变化通知，包含 `type` ("created", "modified", "deleted") 和 `file_path`。
  - **OpenFileRequest**: 打开文件请求，包含 `file_path`。
  - **SaveFileRequest**: 保存文件请求，包含 `file_path` 和 `content`。
  - **SaveFileAckData**: 保存文件确认，包含 `file_path` 和 `status` ("ok")。
  - **LogData**: 日志数据，包含 `level`, `module`, `message`, `timestamp`。
- **文件内部模型**
  - **File**: 本地文件模型，包含 `AbsPath`, `RelPath`, `Name`, `LastModified`。
  - **ToFileInfo()**: `File` 结构体的方法，用于将其转换为对外的 `FileInfo` 结构。

**Section sources**
- [LocalBridge/pkg/models/message.go](file://LocalBridge/pkg/models/message.go#L1-L72)
- [LocalBridge/pkg/models/file.go](file://LocalBridge/pkg/models/file.go#L1-L19)

### 协议与实现对照
- **协议来源**
  - `LocalBridge/README/Agreement.md`：定义了 `/lte/*`（LB→MPE）、`/etl/*`（MPE→LB）、`/ack/*` 确认消息与 `/error` 错误消息等路由。
  - `docsite/docs/01.指南/10.其他/10.通信协议.md`：定义了 `/etc/send_pipeline`（MPE→LB）与 `/cte/send_pipeline`（LB→MPE）等路由。
- **实际实现**
  - 前端请求封装使用的是 `/etc/send_pipeline`，响应路由处理的是 `/cte/send_pipeline`。
  - 两者与协议中的 `/etl/*`、`/lte/*` 命名不一致，但语义一致（编辑器→本地服务 vs 本地服务→编辑器）。
  - 新增的日志推送功能通过事件总线和 `PushHook` 实现，当 `push_to_client` 启用时，日志会以特定格式推送到前端。

**Section sources**
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L36-L191)
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md#L106-L113)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L59-L98)

## 依赖关系分析
- **入口初始化**
  - `src/main.tsx` 中注册响应路由并初始化 WebSocket 服务。
  - `cmd/lb/main.go` 是本地服务的入口，协调所有模块的启动。
- **组件耦合**
  - `LocalWebSocketServer` 与 `MessageHandler` 接口解耦，便于扩展路由。
  - 响应路由依赖文件状态管理，实现文件切换与导入。
  - 文件服务通过事件总线与 WebSocket 服务器通信，实现松耦合。
- **协议依赖**
  - 协议文件与指南文档共同定义了消息格式与路由，前端实现需与之对齐。
  - 配置系统为日志推送、文件扫描等行为提供可配置性。

```mermaid
graph LR
MAIN["src/main.tsx"] --> RESP["src/services/responds.ts"]
MAIN --> SERVER["src/services/server.ts"]
REQ["src/services/requests.ts"] --> SERVER
RESP --> STORE["src/stores/fileStore.ts"]
SERVER --> AG["LocalBridge/README/Agreement.md"]
SERVER --> DOC["docsite/docs/01.指南/10.其他/10.通信协议.md"]
CLI["cmd/lb/main.go"] --> CONF["internal/config/config.go"]
CLI --> LOG["internal/logger/logger.go"]
CLI --> EVENT["internal/eventbus/eventbus.go"]
CLI --> FILE["internal/service/file/file_service.go"]
CLI --> WS["internal/server/websocket.go"]
FILE --> EVENT
WS --> EVENT
LOG --> EVENT
```

**Diagram sources**
- [src/main.tsx](file://src/main.tsx#L1-L23)
- [src/services/server.ts](file://src/services/server.ts#L1-L214)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/stores/fileStore.ts](file://src/stores/fileStore.ts#L1-L255)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L1-L191)
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md#L1-L216)
- [LocalBridge/cmd/lb/main.go](file://LocalBridge/cmd/lb/main.go#L1-L128)

## 性能考量
- **连接与消息处理**
  - 连接超时 3 秒，避免长时间阻塞 UI；消息解析与路由分发为 O(1) 查找，适合高频消息。
- **文件导入**
  - 导入 Pipeline 时涉及 DOM 状态更新与历史记录初始化，建议在批量导入时减少不必要的重绘。
- **日志推送**
  - 协议支持日志推送，前端可根据配置选择是否接收，避免在调试之外场景产生额外流量。
- **文件监听**
  - 使用 `fsnotify` 提供高效的文件系统事件通知。
  - 防抖机制（300ms）防止短时间内大量事件导致性能问题。

[本节为通用指导，不直接分析具体文件]

## 故障排查指南
- **连接失败**
  - 检查本地服务是否运行于 `ws://localhost:9066`；确认端口占用与防火墙设置。
  - 前端会在连接超时、错误与关闭时分别发出提示，可据此定位问题。
- **发送失败**
  - 确认已连接且路径有效；查看前端错误提示与控制台日志。
- **导入失败**
  - 检查服务端是否正确返回确认消息；核对文件路径与文件名冲突情况。
- **文件状态异常**
  - 若文件名重复或路径不一致，前端会给出警告；可在文件面板中修正。
- **日志未推送**
  - 检查 `config/default.json` 中 `log.push_to_client` 是否为 `true`。
  - 确认日志级别是否匹配（INFO、WARN、ERROR）。

**Section sources**
- [src/services/server.ts](file://src/services/server.ts#L57-L134)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/stores/fileStore.ts](file://src/stores/fileStore.ts#L118-L145)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L60-L62)

## 结论
LocalBridge 通信协议以 WebSocket 为基础，通过明确的消息格式与路由命名，实现了编辑器与本地服务之间的稳定双向通信。新实现的 CLI 应用、配置系统、日志系统、事件总线和文件服务模块，使得系统更加模块化、可配置和易于维护。前端实现了连接管理、消息路由与文件导入逻辑，协议与指南文档提供了清晰的 API 规范。实际开发中需关注路由命名一致性、错误处理和配置管理，确保用户体验与稳定性。

[本节为总结，不直接分析具体文件]

## 附录

### 协议要点摘要
- **连接管理**
  - 协议：WebSocket；默认端口：9066；连接超时：3 秒；不自动重连。
- **消息规范**
  - 统一 JSON 结构：{path, data}；路由命名约定：/lte/*（LB→MPE）、/etl/*（MPE→LB）、/ack/*（确认）、/error（错误）。
- **本地文件协议**
  - 根目录扫描规则、文件列表推送、文件内容返回、文件变化通知、错误码与错误消息格式。
- **日志协议**
  - CLI 日志格式与 `/lte/log` 推送消息格式（当 `push_to_client` 启用时）。

**Section sources**
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L7-L21)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L36-L55)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L60-L105)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L134-L176)
- [LocalBridge/README/Agreement.md](file://LocalBridge/README/Agreement.md#L250-L289)
- [LocalBridge/internal/logger/logger.go](file://LocalBridge/internal/logger/logger.go#L59-L98)

### 前端实现要点
- **初始化**
  - 在应用启动时注册响应路由并初始化 WebSocket。
- **发送 Pipeline**
  - 通过 sendCompiledPipeline 发送 `/etc/send_pipeline`。
- **接收 Pipeline**
  - 通过 registerRespondRoutes 注册 `/cte/send_pipeline`，导入并切换文件。
- **文件状态**
  - 使用 useFileStore 维护文件标签页、路径配置与切换逻辑。

**Section sources**
- [src/main.tsx](file://src/main.tsx#L1-L23)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/stores/fileStore.ts](file://src/stores/fileStore.ts#L147-L217)