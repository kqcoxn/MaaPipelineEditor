# API 参考

<cite>
**本文引用的文件**
- [server/main.py](file://server/main.py)
- [server/core/websocket_server.py](file://server/core/websocket_server.py)
- [server/core/handlers.py](file://server/core/handlers.py)
- [server/ui/server_ui.py](file://server/ui/server_ui.py)
- [src/services/server.ts](file://src/services/server.ts)
- [src/services/type.ts](file://src/services/type.ts)
- [src/services/requests.ts](file://src/services/requests.ts)
- [src/services/responds.ts](file://src/services/responds.ts)
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能与可靠性](#性能与可靠性)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件为 MaaPipelineEditor（MPE）前后端 WebSocket 通信协议的完整 API 参考，覆盖连接建立、消息格式、事件类型、前端客户端封装、后端服务器处理、公开通信路径及数据结构、安全与错误处理策略、调试技巧等内容。目标读者既包括需要集成 MPE 本地通信能力的开发者，也包括希望理解其内部工作原理的使用者。

## 项目结构
- 前端位于 src/，包含 WebSocket 客户端封装、请求与响应路由注册、类型定义等。
- 后端位于 server/，包含 WebSocket 服务器核心、消息处理器、UI 控制台等。
- 文档位于 docsite/docs/，包含通信协议说明与示例。

```mermaid
graph TB
subgraph "前端(src)"
FE_Server["LocalWebSocketServer<br/>src/services/server.ts"]
FE_Requests["sendCompiledPipeline<br/>src/services/requests.ts"]
FE_Responds["registerRespondRoutes<br/>src/services/responds.ts"]
FE_Type["类型定义<br/>src/services/type.ts"]
end
subgraph "后端(server)"
BE_Main["入口 main.py"]
BE_WS["WebSocketTestServer<br/>server/core/websocket_server.py"]
BE_Hdl["MessageHandler<br/>server/core/handlers.py"]
BE_UI["ServerUI<br/>server/ui/server_ui.py"]
end
FE_Server --> |"发送/接收消息"| BE_WS
FE_Requests --> |"发送 /etc/send_pipeline"| FE_Server
FE_Responds --> |"注册 /cte/send_pipeline 路由"| FE_Server
BE_WS --> |"分发消息"| BE_Hdl
BE_Main --> BE_WS
BE_UI --> BE_WS
```

图表来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)
- [server/main.py](file://server/main.py#L1-L23)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)
- [server/main.py](file://server/main.py#L1-L23)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

## 核心组件
- 前端 WebSocket 客户端封装：负责连接管理、消息发送与接收、路由注册与分发、连接状态与超时处理。
- 后端 WebSocket 服务器：负责监听端口、维护客户端集合、消息分发、主动推送 Pipeline。
- 消息处理器：根据 path 路由分发到具体处理函数，返回 ack 或错误消息。
- 文档协议：定义默认端口、消息格式、API 路由与数据结构。

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md#L1-L216)

## 架构总览
MPE 的本地通信基于 WebSocket（RFC 6455），默认端口 9066，地址 ws://localhost:9066。前端通过 LocalWebSocketServer 统一管理连接与消息路由；后端通过 WebSocketTestServer 接收消息并交由 MessageHandler 分发处理。

```mermaid
sequenceDiagram
participant FE as "前端 LocalWebSocketServer<br/>src/services/server.ts"
participant WS as "后端 WebSocketTestServer<br/>server/core/websocket_server.py"
participant HD as "消息处理器 MessageHandler<br/>server/core/handlers.py"
FE->>WS : "连接 ws : //localhost : 9066"
WS-->>FE : "onopen 连接成功"
FE->>WS : "发送 {path : '/etc/send_pipeline', data : {file_path,pipeline}}"
WS->>HD : "handle_message 解析并路由"
HD-->>WS : "写入文件/存储并返回 ack"
WS-->>FE : "发送 {path : '/etc/send_pipeline/ack', data : {status,file_path,message}}"
WS-->>FE : "主动推送 {path : '/cte/send_pipeline', data : {file_path,pipeline}}"
FE->>FE : "注册 /cte/send_pipeline 路由并导入到编辑器"
```

图表来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)

## 详细组件分析

### 前端 WebSocket 客户端封装（LocalWebSocketServer）
- 连接管理
  - 默认端口 9066，地址 ws://localhost:9066。
  - 防重复连接、连接超时（3 秒）、连接状态与“连接中”状态回调。
  - 断开连接与资源清理。
- 消息发送与接收
  - 发送：将 {path, data} 序列化为 JSON 并发送。
  - 接收：解析 JSON，按 path 查找已注册路由并调用对应 handler。
- 路由注册机制
  - registerRoute(path, handler) 与 registerRoutes(routes) 批量注册。
  - 支持动态 setPort 与重新连接。
- 典型使用
  - 初始化：initializeWebSocket()（占位函数，实际初始化在应用启动时进行）。
  - 发送编译后的 Pipeline：sendCompiledPipeline() 通过 /etc/send_pipeline 路由发送。
  - 注册响应路由：registerRespondRoutes() 注册 /cte/send_pipeline 路由，将服务端推送的 Pipeline 导入编辑器。

```mermaid
classDiagram
class LocalWebSocketServer {
-ws : WebSocket|null
-url : string
-routes : Map~string, MessageHandler~
-onStatusChange : (connected : boolean)=>void
-onConnectingChange : (isConnecting : boolean)=>void
-connectTimeout : number|null
-isConnecting : boolean
-CONNECTION_TIMEOUT : number
+constructor(port)
+setPort(port)
+onStatus(callback)
+onConnecting(callback)
+registerRoute(path, handler)
+registerRoutes(routes)
+connect()
+disconnect()
+send(path, data) boolean
+isConnected() boolean
+getIsConnecting() boolean
+destroy()
}
class MessageHandler {
<<function type>>
}
LocalWebSocketServer --> MessageHandler : "注册/调用"
```

图表来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)

### 后端 WebSocket 服务器与消息处理
- 服务器核心
  - WebSocketTestServer：监听 localhost:9066，维护客户端集合，记录日志并通过 UI 回调输出。
  - 提供 send_message(path, data) 统一发送消息格式。
  - 主动推送：send_pipeline_to_client(file_path, pipeline) 向所有客户端广播 /cte/send_pipeline。
- 消息处理
  - MessageHandler.handle_message：解析 JSON，按 path 分发。
  - /etc/send_pipeline：接收前端发送的 Pipeline，校验数据、写入本地文件、存储到内存、返回 /etc/send_pipeline/ack。
  - /api/request_pipeline：根据 file_path 返回已缓存的 Pipeline 或 /error。
  - 未识别路由：返回 /error。
  - JSON 解析失败：返回 /error。
- UI 控制台
  - ServerUI：提供端口配置、启动/停止服务器、状态显示、Pipeline 列表等。

```mermaid
flowchart TD
Start(["收到消息"]) --> Parse["解析 JSON<br/>提取 path/data"]
Parse --> Route{"path 分类"}
Route --> |"/etc/send_pipeline"| SendPipeline["校验/写文件/存储"]
SendPipeline --> Ack["发送 /etc/send_pipeline/ack"]
Route --> |"/api/request_pipeline"| RequestPipeline["查找缓存并返回"]
RequestPipeline --> Found{"找到?"}
Found --> |是| RespPipeline["发送 /api/response_pipeline"]
Found --> |否| ErrNotFound["发送 /error"]
Route --> |其他| ErrUnknown["发送 /error"]
Parse --> |JSON 解析失败| ErrJson["发送 /error"]
Ack --> End(["结束"])
RespPipeline --> End
ErrNotFound --> End
ErrUnknown --> End
ErrJson --> End
```

图表来源
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

章节来源
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

### 通信路径与数据结构
- 默认端口与地址
  - 默认端口：9066
  - 地址：ws://localhost:9066
  - 连接超时：3 秒
- 消息格式
  - 统一 JSON 结构：{ path: string, data: any }
- 路由与数据结构
  - 发送 Pipeline（MPE → 本地服务）
    - 路径：/etc/send_pipeline
    - 请求数据：
      - file_path: string（目标文件绝对路径）
      - pipeline: object（Pipeline JSON 对象）
    - 响应数据：
      - /etc/send_pipeline/ack：包含 status、file_path、message
    - 错误数据：
      - /error：包含 status、message
  - 接收 Pipeline（本地服务 → MPE）
    - 路径：/cte/send_pipeline
    - 请求数据：
      - file_path: string（文件路径标识）
      - pipeline: object|string（Pipeline JSON 对象或 JSON 字符串）
    - 处理逻辑（前端）：
      - 若已存在同路径文件：切换并更新内容
      - 若当前文件路径匹配：直接更新
      - 否则：新建文件并导入，保存文件路径到配置
- 参考示例与最小化服务端示例
  - 参考文档提供了最小化服务端示例与连接流程说明。

章节来源
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md#L1-L216)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)

## 依赖关系分析
- 前端依赖
  - LocalWebSocketServer 依赖类型定义 type.ts，用于声明 MessageHandler 与 APIRoute。
  - 请求模块 requests.ts 依赖 LocalWebSocketServer 与 flowToPipeline，通过 /etc/send_pipeline 发送编译后的 Pipeline。
  - 响应模块 responds.ts 依赖 LocalWebSocketServer 与 pipelineToFlow，注册 /cte/send_pipeline 路由并导入到编辑器。
- 后端依赖
  - main.py 作为入口，实例化 ServerUI 并运行。
  - WebSocketTestServer 依赖 websockets，维护客户端集合，委托 MessageHandler 处理消息。
  - MessageHandler 依赖 os/json/logging，执行文件写入与错误回传。
  - ServerUI 提供 UI 控制与状态显示。

```mermaid
graph LR
FE_Server["src/services/server.ts"] --> FE_Type["src/services/type.ts"]
FE_Requests["src/services/requests.ts"] --> FE_Server
FE_Responds["src/services/responds.ts"] --> FE_Server
BE_Main["server/main.py"] --> BE_WS["server/core/websocket_server.py"]
BE_WS --> BE_Hdl["server/core/handlers.py"]
BE_UI["server/ui/server_ui.py"] --> BE_WS
```

图表来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [server/main.py](file://server/main.py#L1-L23)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [src/services/type.ts](file://src/services/type.ts#L1-L9)
- [src/services/requests.ts](file://src/services/requests.ts#L1-L46)
- [src/services/responds.ts](file://src/services/responds.ts#L1-L69)
- [server/main.py](file://server/main.py#L1-L23)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

## 性能与可靠性
- 连接与超时
  - 前端连接超时 3 秒，避免长时间阻塞 UI。
  - 重复连接保护：正在连接中时禁止再次发起连接。
- 消息处理
  - JSON 解析失败与未识别路由均返回 /error，便于前端快速定位问题。
  - 后端写文件操作在主线程执行，建议在生产环境中考虑异步化与并发控制。
- 日志与可观测性
  - 后端支持日志输出到控制台与 UI 回调，便于调试与运维。

[本节为通用建议，不直接分析具体文件]

## 故障排查指南
- 连接失败
  - 检查本地服务是否启动且端口 9066 可用。
  - 前端提示“连接失败/连接超时”，确认 ws://localhost:9066 可达。
- 消息解析失败
  - 后端返回 /error，前端打印“Failed to parse message”，检查消息格式是否为 {path, data}。
- 路由未识别
  - 后端返回 /error，前端打印“No handler for path”，检查 path 是否正确。
- 文件写入失败
  - 后端返回 /error，检查 file_path 是否存在、权限是否足够、磁盘空间是否充足。
- 调试技巧
  - 使用浏览器开发者工具的 Network → WebSocket 面板，观察帧数据与时间戳，核对 path 与 data。
  - 在后端 UI 控制台查看日志输出，确认连接、消息到达与处理结果。

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)

## 结论
MPE 的本地通信协议以 WebSocket 为基础，采用统一的 JSON 消息格式与路由化设计，前后端职责清晰：前端负责连接与路由分发，后端负责消息路由与持久化。通过明确的错误回传与日志输出，开发者可以快速集成与排障。建议在生产环境中进一步优化文件写入与并发处理，并完善 UI 与日志的可观测性。

[本节为总结，不直接分析具体文件]

## 附录

### 安全考虑（本地服务限制）
- 仅监听本地地址（localhost），默认端口 9066，避免暴露至公网。
- 建议在生产环境增加鉴权或白名单机制（例如仅允许特定 IP 或令牌验证）。
- 文件写入需校验路径与权限，避免越权写入。

章节来源
- [docsite/docs/01.指南/10.其他/10.通信协议.md](file://docsite/docs/01.指南/10.其他/10.通信协议.md#L1-L216)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)

### 错误处理策略
- 前端
  - 连接超时：关闭连接句柄、重置状态、提示用户。
  - 连接错误/关闭：重置状态、提示用户。
  - 发送失败：捕获异常并返回 false。
- 后端
  - JSON 解析失败：返回 /error。
  - 未识别路由：返回 /error。
  - 文件写入失败：返回 /error。
  - 连接断开：记录日志并清理客户端集合。

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [server/core/websocket_server.py](file://server/core/websocket_server.py#L1-L109)
- [server/core/handlers.py](file://server/core/handlers.py#L1-L143)

### 调试技巧
- 浏览器开发者工具
  - Network → WebSocket：查看帧数据、时间戳、消息体。
  - Console：查看前端日志与警告。
- 后端 UI 控制台
  - 查看服务器启动、客户端连接、消息到达与处理结果的日志。

章节来源
- [src/services/server.ts](file://src/services/server.ts#L1-L215)
- [server/ui/server_ui.py](file://server/ui/server_ui.py#L1-L200)