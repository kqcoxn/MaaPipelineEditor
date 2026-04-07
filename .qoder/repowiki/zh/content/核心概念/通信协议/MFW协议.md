# MFW协议

<cite>
**本文引用的文件**
- [LocalBridge/internal/mfw/service.go](file://LocalBridge/internal/mfw/service.go)
- [LocalBridge/internal/mfw/controller_manager.go](file://LocalBridge/internal/mfw/controller_manager.go)
- [LocalBridge/internal/mfw/device_manager.go](file://LocalBridge/internal/mfw/device_manager.go)
- [LocalBridge/internal/mfw/resource_manager.go](file://LocalBridge/internal/mfw/resource_manager.go)
- [LocalBridge/internal/mfw/task_manager.go](file://LocalBridge/internal/mfw/task_manager.go)
- [LocalBridge/internal/mfw/types.go](file://LocalBridge/internal/mfw/types.go)
- [LocalBridge/internal/mfw/error.go](file://LocalBridge/internal/mfw/error.go)
- [LocalBridge/internal/mfw/adapter.go](file://LocalBridge/internal/mfw/adapter.go)
- [LocalBridge/internal/mfw/reco_detail_helper.go](file://LocalBridge/internal/mfw/reco_detail_helper.go)
- [LocalBridge/internal/mfw/event_sink.go](file://LocalBridge/internal/mfw/event_sink.go)
- [LocalBridge/internal/protocol/mfw/handler.go](file://LocalBridge/internal/protocol/mfw/handler.go)
- [LocalBridge/internal/protocol/debug/handler_v2.go](file://LocalBridge/internal/protocol/debug/handler_v2.go)
- [LocalBridge/internal/config/config.go](file://LocalBridge/internal/config/config.go)
- [src/services/protocols/MFWProtocol.ts](file://src/services/protocols/MFWProtocol.ts)
- [src/stores/mfwStore.ts](file://src/stores/mfwStore.ts)
- [src/services/server.ts](file://src/services/server.ts)
- [LocalBridge/pkg/models/mfw.go](file://LocalBridge/pkg/models/mfw.go)
</cite>

## 更新摘要
**所做更改**
- 新增macOS控制器创建支持，扩展控制器类型为五种（ADB、Win32、PlayCover、Gamepad、macOS原生）
- 更新控制器管理器以支持macOS原生应用控制器的创建和管理
- 完善前端协议以支持macOS控制器的创建、连接和状态管理
- 增强设备发现和管理机制，支持macOS应用进程的识别和连接
- 更新数据结构和类型定义以支持新的macOS控制器类型

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向MFW协议（MaaFramework协议）的技术文档，系统阐述其与MaaFramework的集成机制、通信协议、设备控制、OCR识别、图像处理、控制器生命周期管理、任务调度与执行、结果返回、服务初始化与运行时管理策略，以及与前端的API对接与数据交换格式。文档同时覆盖错误处理、超时控制与重试机制的实现要点。

**更新** 本次更新重点反映了MFW协议的重大增强：新增macOS控制器创建支持，现支持五种控制器类型（ADB、Win32、PlayCover、Gamepad、macOS原生），显著扩展了跨平台设备控制能力。

## 项目结构
MFW协议涉及前后端协作：前端通过WebSocket协议向本地桥接服务发送请求，后端解析路由并调用MFW服务层（设备、控制器、资源、任务管理器），最终与MaaFramework交互完成操作；调试协议提供流程级调试能力。

```mermaid
graph TB
subgraph "前端"
FE["MFWProtocol.ts<br/>WebSocket客户端"]
Store["mfwStore.ts<br/>状态管理"]
WS["LocalWebSocketServer<br/>路由系统"]
End
subgraph "本地桥接服务"
Proto["MFW协议处理器<br/>/etl/mfw/*"]
DebugV2["调试协议处理器V2<br/>/mpe/debug/*"]
Service["MFW服务<br/>Service"]
DevMgr["设备管理器<br/>DeviceManager"]
CtrlMgr["控制器管理器<br/>ControllerManager"]
ResMgr["资源管理器<br/>ResourceManager"]
TaskMgr["任务管理器<br/>TaskManager"]
Adapter["MaaFW适配器<br/>MaaFWAdapter"]
EventSink["事件Sink<br/>SimpleContextSink/SimpleTaskerSink"]
end
subgraph "MaaFramework"
FW["MaaFramework<br/>Controller/Resource/Tasker"]
end
FE --> WS
WS --> Proto
FE --> DebugV2
Proto --> Service
DebugV2 --> Service
Service --> DevMgr
Service --> CtrlMgr
Service --> ResMgr
Service --> TaskMgr
CtrlMgr --> FW
ResMgr --> FW
TaskMgr --> FW
Adapter --> FW
EventSink --> FW
Store -.-> FE
```

**图表来源**
- [src/services/protocols/MFWProtocol.ts:16-97](file://src/services/protocols/MFWProtocol.ts#L16-L97)
- [src/services/server.ts:20-100](file://src/services/server.ts#L20-L100)
- [LocalBridge/internal/protocol/mfw/handler.go:24-117](file://LocalBridge/internal/protocol/mfw/handler.go#L24-L117)
- [LocalBridge/internal/protocol/debug/handler_v2.go:30-79](file://LocalBridge/internal/protocol/debug/handler_v2.go#L30-L79)
- [LocalBridge/internal/mfw/service.go:15-23](file://LocalBridge/internal/mfw/service.go#L15-L23)
- [LocalBridge/internal/mfw/controller_manager.go:20-31](file://LocalBridge/internal/mfw/controller_manager.go#L20-L31)
- [LocalBridge/internal/mfw/device_manager.go:11-24](file://LocalBridge/internal/mfw/device_manager.go#L11-L24)
- [LocalBridge/internal/mfw/resource_manager.go:13-24](file://LocalBridge/internal/mfw/resource_manager.go#L13-L24)
- [LocalBridge/internal/mfw/task_manager.go:11-22](file://LocalBridge/internal/mfw/task_manager.go#L11-L22)
- [LocalBridge/internal/mfw/adapter.go:23-50](file://LocalBridge/internal/mfw/adapter.go#L23-L50)
- [LocalBridge/internal/mfw/event_sink.go:61-71](file://LocalBridge/internal/mfw/event_sink.go#L61-L71)

**章节来源**
- [src/services/protocols/MFWProtocol.ts:16-97](file://src/services/protocols/MFWProtocol.ts#L16-L97)
- [src/services/server.ts:20-100](file://src/services/server.ts#L20-L100)
- [LocalBridge/internal/protocol/mfw/handler.go:24-117](file://LocalBridge/internal/protocol/mfw/handler.go#L24-L117)
- [LocalBridge/internal/protocol/debug/handler_v2.go:30-79](file://LocalBridge/internal/protocol/debug/handler_v2.go#L30-L79)
- [LocalBridge/internal/mfw/service.go:15-23](file://LocalBridge/internal/mfw/service.go#L15-L23)

## 核心组件
- MFW服务（Service）：统一管理设备、控制器、资源、任务管理器，负责初始化与释放。
- 设备管理器（DeviceManager）：枚举ADB设备与Win32窗口，提供可用截图/输入方法列表。
- 控制器管理器（ControllerManager）：创建/连接/断开控制器，执行点击、滑动、输入、应用启停、手柄操作、滚动、Shell等操作，并支持截图。
- 资源管理器（ResourceManager）：加载/卸载资源包，支持多路径叠加加载。
- 任务管理器（TaskManager）：提交/查询/停止任务。
- MaaFW适配器（MaaFWAdapter）：封装Controller/Resource/Tasker/Agent生命周期与事件回调，提供统一接口。
- 事件Sink（SimpleContextSink/SimpleTaskerSink）：简化并过滤关键事件，上报节点/识别/动作/任务/资源事件。
- 协议处理器（MFWHandler/DebugHandlerV2）：解析前端WebSocket路由，调用对应服务层方法。
- 前端协议（MFWProtocol）：封装WebSocket消息路由与回调，提供设备刷新、控制器创建、操作下发、截图/OCR回调等。
- WebSocket路由系统：基于LocalWebSocketServer的路由注册机制，支持动态路由管理和回调管理。
- 配置（Config）：MaaFramework库路径、资源目录等全局配置。

**更新** 现在支持五种控制器类型，包括新增的macOS原生应用控制器，显著扩展了跨平台设备控制能力。

**章节来源**
- [LocalBridge/internal/mfw/service.go:15-23](file://LocalBridge/internal/mfw/service.go#L15-L23)
- [LocalBridge/internal/mfw/device_manager.go:11-24](file://LocalBridge/internal/mfw/device_manager.go#L11-L24)
- [LocalBridge/internal/mfw/controller_manager.go:20-31](file://LocalBridge/internal/mfw/controller_manager.go#L20-L31)
- [LocalBridge/internal/mfw/resource_manager.go:13-24](file://LocalBridge/internal/mfw/resource_manager.go#L13-L24)
- [LocalBridge/internal/mfw/task_manager.go:11-22](file://LocalBridge/internal/mfw/task_manager.go#L11-L22)
- [LocalBridge/internal/mfw/adapter.go:23-50](file://LocalBridge/internal/mfw/adapter.go#L23-L50)
- [LocalBridge/internal/mfw/event_sink.go:61-71](file://LocalBridge/internal/mfw/event_sink.go#L61-L71)
- [LocalBridge/internal/protocol/mfw/handler.go:11-21](file://LocalBridge/internal/protocol/mfw/handler.go#L11-L21)
- [LocalBridge/internal/protocol/debug/handler_v2.go:16-28](file://LocalBridge/internal/protocol/debug/handler_v2.go#L16-L28)
- [src/services/protocols/MFWProtocol.ts:16-97](file://src/services/protocols/MFWProtocol.ts#L16-L97)
- [src/services/server.ts:20-100](file://src/services/server.ts#L20-L100)
- [LocalBridge/internal/config/config.go:35-48](file://LocalBridge/internal/config/config.go#L35-L48)

## 架构总览
MFW协议采用"前端WebSocket协议 + 后端协议处理器 + 服务层管理器 + MaaFramework"的分层设计。前端通过MFWProtocol封装的路由向后端发送请求，后端MFWHandler根据路由分发到具体服务层方法，服务层再调用MaaFramework完成设备/控制器/资源/任务的实际操作。调试协议提供会话级控制与事件回传。

```mermaid
sequenceDiagram
participant FE as "前端 MFWProtocol"
participant WS as "WebSocket路由系统"
participant Proto as "MFW协议处理器"
participant Svc as "MFW服务"
participant Ctl as "控制器管理器"
participant FW as "MaaFramework"
FE->>WS : "/etl/mfw/create_macos_controller"
WS->>Proto : 路由分发
Proto->>Svc : 调用 ControllerManager.CreateMacOSController
Svc->>Ctl : 创建并连接macOS控制器
Ctl->>FW : NewMacOSController + PostConnect
FW-->>Ctl : 连接结果
Ctl-->>Svc : 返回控制器ID
Svc-->>Proto : 返回控制器创建结果
Proto-->>WS : "/lte/mfw/controller_created"
WS-->>FE : 路由回调处理
```

**图表来源**
- [src/services/protocols/MFWProtocol.ts:538-540](file://src/services/protocols/MFWProtocol.ts#L538-L540)
- [src/services/server.ts:93-102](file://src/services/server.ts#L93-L102)
- [LocalBridge/internal/protocol/mfw/handler.go:351-384](file://LocalBridge/internal/protocol/mfw/handler.go#L351-L384)
- [LocalBridge/internal/mfw/controller_manager.go:249-276](file://LocalBridge/internal/mfw/controller_manager.go#L249-L276)

## 详细组件分析

### MFW服务与生命周期管理
- 初始化：读取配置库路径，处理Windows非ASCII路径问题，设置日志目录，调用MaaFramework初始化并设置相关行为（如SaveOnError）。
- 关闭：停止所有任务、断开所有控制器、卸载所有资源、释放框架。
- 重载：先Shutdown再Initialize，用于配置变更后的热重载。

```mermaid
flowchart TD
Start(["初始化入口"]) --> CheckCfg["读取全局配置<br/>获取库路径"]
CheckCfg --> PathFix{"Windows 非ASCII路径?"}
PathFix --> |是| TryShort["尝试短路径/工作目录切换"]
PathFix --> |否| InitFW["调用 MaaFramework 初始化"]
TryShort --> InitFW
InitFW --> SetOpts["设置日志/保存截图/调试级别"]
SetOpts --> Done(["初始化完成"])
```

**图表来源**
- [LocalBridge/internal/mfw/service.go:36-138](file://LocalBridge/internal/mfw/service.go#L36-L138)

**章节来源**
- [LocalBridge/internal/mfw/service.go:36-138](file://LocalBridge/internal/mfw/service.go#L36-L138)

### 设备管理与发现
- ADB设备：调用FindAdbDevices，返回设备列表与可用截图/输入方法集合。
- Win32窗口：调用FindDesktopWindows，返回窗口列表与可用截图/输入方法集合。
- **macOS应用**：新增macOS应用进程发现功能，支持通过进程ID连接原生macOS应用。
- **WlRoots合成器**：调用RefreshWlRootsSockets，返回WlRoots合成器列表（当前为空列表，需手动输入socket路径）。
- 方法列表用于前端选择，提升兼容性与成功率。

**更新** 新增macOS应用进程发现功能，支持通过进程ID连接原生macOS应用，显著扩展了跨平台设备控制能力。

**章节来源**
- [LocalBridge/internal/mfw/device_manager.go:26-95](file://LocalBridge/internal/mfw/device_manager.go#L26-L95)
- [LocalBridge/internal/mfw/device_manager.go:98-112](file://LocalBridge/internal/mfw/device_manager.go#L98-L112)

### 控制器管理与设备控制
- 支持类型：ADB、Win32、PlayCover、Gamepad、**macOS原生**。
- 创建与连接：自动连接，超时控制（连接等待通道+10秒超时）。
- 操作集：点击、滑动、输入文本、启动/停止应用、手柄按键/触摸、滚动、按键按下/释放、Shell命令、恢复状态等。
- 截图：支持目标长边/短边、原始尺寸、缓存策略；返回Base64 PNG。
- 清理：非活跃控制器定时清理，避免资源泄露。

**更新** 新增macOS原生应用控制器支持，包括创建、连接、断开和管理功能，现支持五种控制器类型。

```mermaid
classDiagram
class ControllerManager {
+CreateAdbController(...)
+CreateWin32Controller(...)
+CreatePlayCoverController(...)
+CreateGamepadController(...)
+CreateMacOSController(pid, screencapMethod, inputMethod)
+ConnectController(id)
+DisconnectController(id)
+Click(id,x,y)
+Swipe(id,x1,y1,x2,y2,duration)
+InputText(id,text)
+StartApp(id,package)
+StopApp(id,package)
+ClickGamepadKey(id,keycode)
+TouchGamepadControl(id,contact,x,y,pressure,action)
+Scroll(id,dx,dy)
+KeyDown(id,keycode)
+KeyUp(id,keycode)
+ClickV2(id,x,y,contact,pressure)
+SwipeV2(id,x1,y1,x2,y2,duration,contact,pressure)
+Shell(id,command,timeout)
+Screencap(req)
+Inactive(id)
+CleanupInactive(timeout)
}
class ControllerInfo {
+ControllerID
+Type
+Connected
+UUID
+CreatedAt
+LastActiveAt
}
class ScreencapRequest {
+ControllerID
+UseCache
+TargetLongSide
+TargetShortSide
+UseRawSize
}
class ScreencapResult {
+ControllerID
+Success
+ImageData
+Width
+Height
+Timestamp
+Error
}
ControllerManager --> ControllerInfo : "管理"
ControllerManager --> ScreencapRequest : "使用"
ControllerManager --> ScreencapResult : "返回"
```

**图表来源**
- [LocalBridge/internal/mfw/controller_manager.go:20-31](file://LocalBridge/internal/mfw/controller_manager.go#L20-L31)
- [LocalBridge/internal/mfw/types.go:40-49](file://LocalBridge/internal/mfw/types.go#L40-L49)
- [LocalBridge/internal/mfw/types.go:72-90](file://LocalBridge/internal/mfw/types.go#L72-L90)

**章节来源**
- [LocalBridge/internal/mfw/controller_manager.go:249-276](file://LocalBridge/internal/mfw/controller_manager.go#L249-L276)
- [LocalBridge/internal/mfw/controller_manager.go:278-329](file://LocalBridge/internal/mfw/controller_manager.go#L278-L329)
- [LocalBridge/internal/mfw/types.go:40-90](file://LocalBridge/internal/mfw/types.go#L40-L90)

### macOS原生应用控制器支持
**新增功能** 完整的macOS原生应用控制器支持：

- **创建macOS控制器**：通过CreateMacOSController方法创建macOS原生应用控制器实例
- **进程ID连接**：支持通过进程ID连接正在运行的macOS应用
- **截图方法**：支持多种截图方法配置，包括伪最小化截图等高级选项
- **输入方法**：支持多种输入方法配置，包括SendInput和PostMessage等
- **连接管理**：自动连接，支持超时控制和UUID获取
- **类型标识**：控制器类型标记为"macOS"，设备信息记录进程ID和应用名称
- **适配器集成**：MaaFWAdapter支持ConnectMacOS方法进行控制器连接

```mermaid
flowchart TD
Start(["macOS控制器创建"]) --> ParsePID["解析进程ID"]
ParsePID --> Create["CreateMacOSController<br/>创建macOS控制器实例"]
Create --> ParseMethods["解析截图和输入方法"]
ParseMethods --> Connect["ConnectController<br/>自动连接"]
Connect --> PostConnect["PostConnect<br/>异步连接"]
PostConnect --> Wait["等待连接完成<br/>10秒超时"]
Wait --> Success{"连接成功?"}
Success --> |是| GetUUID["获取UUID"]
Success --> |否| Error["返回连接失败错误"]
GetUUID --> SetInfo["设置控制器信息<br/>类型=macOS, UUID=进程ID"]
SetInfo --> Done(["控制器就绪"])
Error --> End(["结束"])
```

**图表来源**
- [LocalBridge/internal/mfw/controller_manager.go:249-276](file://LocalBridge/internal/mfw/controller_manager.go#L249-L276)
- [LocalBridge/internal/mfw/controller_manager.go:278-329](file://LocalBridge/internal/mfw/controller_manager.go#L278-L329)
- [LocalBridge/internal/mfw/adapter.go:169-209](file://LocalBridge/internal/mfw/adapter.go#L169-L209)

**章节来源**
- [LocalBridge/internal/mfw/controller_manager.go:249-329](file://LocalBridge/internal/mfw/controller_manager.go#L249-L329)
- [LocalBridge/internal/mfw/adapter.go:169-209](file://LocalBridge/internal/mfw/adapter.go#L169-L209)
- [LocalBridge/internal/protocol/mfw/handler.go:351-384](file://LocalBridge/internal/protocol/mfw/handler.go#L351-L384)

### 资源管理与OCR识别
- 资源加载：支持多路径叠加加载，加载完成后计算哈希；支持Windows非ASCII路径处理与工作目录切换。
- 资源卸载：销毁资源实例并清空列表。
- OCR识别：前端通过"/etl/utility/ocr_recognize"发起请求，后端在MFWHandler中转发至工具链（此处为协议层定义，具体OCR实现由工具链或MaaFramework资源提供）。

**章节来源**
- [LocalBridge/internal/mfw/resource_manager.go:26-105](file://LocalBridge/internal/mfw/resource_manager.go#L26-L105)
- [LocalBridge/internal/protocol/mfw/handler.go:773-800](file://LocalBridge/internal/protocol/mfw/handler.go#L773-L800)

### 任务管理与执行
- 提交任务：创建Tasker，填充TaskInfo并登记状态。
- 查询状态：按TaskID查询状态。
- 停止任务：PostStop并等待，更新状态。
- 停止所有任务：遍历并销毁Tasker，清空列表。

```mermaid
sequenceDiagram
participant FE as "前端"
participant Proto as "MFW协议处理器"
participant Svc as "MFW服务"
participant TM as "任务管理器"
participant FW as "MaaFramework Tasker"
FE->>Proto : "/etl/mfw/submit_task"
proto->>Svc : TaskManager.SubmitTask
Svc->>TM : 创建Tasker并登记
TM->>FW : NewTasker
FW-->>TM : 返回Tasker
TM-->>Svc : 返回TaskID
Svc-->>Proto : 返回任务提交结果
Proto-->>FE : "/lte/mfw/task_submitted"
FE->>Proto : "/etl/mfw/query_task_status"
Proto->>Svc : TaskManager.GetTaskStatus
Svc-->>Proto : 返回状态
Proto-->>FE : "/lte/mfw/task_status"
```

**图表来源**
- [LocalBridge/internal/protocol/mfw/handler.go:684-743](file://LocalBridge/internal/protocol/mfw/handler.go#L684-L743)
- [LocalBridge/internal/mfw/task_manager.go:24-66](file://LocalBridge/internal/mfw/task_manager.go#L24-L66)

**章节来源**
- [LocalBridge/internal/mfw/task_manager.go:24-114](file://LocalBridge/internal/mfw/task_manager.go#L24-L114)
- [LocalBridge/internal/protocol/mfw/handler.go:684-771](file://LocalBridge/internal/protocol/mfw/handler.go#L684-L771)

### 直接动作执行支持
**新增功能** 探索模式下的直接动作执行能力：

- **探索模式执行**：支持在探索模式下执行单个Pipeline节点的动作
- **参数结构**：包含识别类型、动作类型及其参数
- **回调机制**：提供execute_action_result路由和onExecuteActionResult回调
- **当前限制**：需要Resource支持，暂未完全实现

```mermaid
sequenceDiagram
participant FE as "前端 MFWProtocol"
participant WS as "WebSocket路由系统"
participant Proto as "MFW协议处理器"
participant Svc as "MFW服务"
FE->>WS : "/etl/mfw/execute_action"
WS->>Proto : 路由分发
Proto->>Svc : 探索模式执行动作
Note over Proto,Svc : 需要Resource支持
Proto-->>WS : "/lte/mfw/execute_action_result"
WS-->>FE : 路由回调处理
FE->>FE : onExecuteActionResult回调
```

**图表来源**
- [LocalBridge/internal/protocol/mfw/handler.go:750-852](file://LocalBridge/internal/protocol/mfw/handler.go#L750-L852)
- [src/services/protocols/MFWProtocol.ts:864-904](file://src/services/protocols/MFWProtocol.ts#L864-L904)

**章节来源**
- [LocalBridge/internal/protocol/mfw/handler.go:750-852](file://LocalBridge/internal/protocol/mfw/handler.go#L750-L852)
- [src/services/protocols/MFWProtocol.ts:864-904](file://src/services/protocols/MFWProtocol.ts#L864-L904)

### WebSocket路由系统与回调管理
**新增功能** 增强的路由系统和回调管理：

- **路由注册**：基于LocalWebSocketServer的registerRoute方法
- **动态路由**：支持运行时注册和注销路由处理器
- **回调管理**：维护executeActionCallbacks数组管理回调函数
- **错误处理**：统一的回调异常捕获和错误处理

```mermaid
classDiagram
class LocalWebSocketServer {
+routes : Map~string, MessageHandler~
+registerRoute(path, handler)
+registerRoutes(routes)
+send(path, data)
}
class MFWProtocol {
+executeActionCallbacks : Array
+executeAction(params)
+onExecuteActionResult(callback)
}
LocalWebSocketServer --> MFWProtocol : "路由分发"
MFWProtocol --> LocalWebSocketServer : "注册回调"
```

**图表来源**
- [src/services/server.ts:93-102](file://src/services/server.ts#L93-L102)
- [src/services/protocols/MFWProtocol.ts:25-26](file://src/services/protocols/MFWProtocol.ts#L25-L26)
- [src/services/protocols/MFWProtocol.ts:888-904](file://src/services/protocols/MFWProtocol.ts#L888-L904)

**章节来源**
- [src/services/server.ts:93-102](file://src/services/server.ts#L93-L102)
- [src/services/protocols/MFWProtocol.ts:25-26](file://src/services/protocols/MFWProtocol.ts#L25-L26)
- [src/services/protocols/MFWProtocol.ts:888-904](file://src/services/protocols/MFWProtocol.ts#L888-L904)

### MaaFW适配器与事件回传
- 适配器职责：统一管理Controller/Resource/Tasker/Agent生命周期，提供RunTask/PostTask/StopTask等接口，内置截图缓存器。
- 事件回传：注册SimpleContextSink/SimpleTaskerSink，过滤关键事件并上报节点/识别/动作/任务/资源事件。
- 识别详情：通过原生API辅助函数获取识别算法、框选区域、原始图像与绘制图像列表，便于调试与可视化。

**更新** MaaFWAdapter现在包含ConnectMacOS方法，支持macOS原生应用控制器的连接管理。

```mermaid
classDiagram
class MaaFWAdapter {
+ConnectADB(...)
+ConnectWin32(...)
+ConnectMacOS(pid, screencapMethod, inputMethod)
+SetController(...)
+GetController()
+LoadResource(...)
+LoadResources(...)
+SetResource(...)
+GetResource()
+InitTasker()
+GetTasker()
+RunTask(entry, override)
+PostTask(entry, override)
+StopTask()
+PostStop()
+ConnectAgent(identifier)
+DisconnectAgent()
+IsAgentConnected()
+AddContextSink(...)
+RemoveContextSink(...)
+AddTaskerSink(...)
+RemoveTaskerSink(...)
+Screencap()/ScreencapImage()
+Destroy()
+GetStatus()
}
class Screenshotter {
+SetController(ctrl)
+SetCacheTTL(ttl)
+Capture()/CaptureBase64()
}
MaaFWAdapter --> Screenshotter : "组合"
```

**图表来源**
- [LocalBridge/internal/mfw/adapter.go:23-50](file://LocalBridge/internal/mfw/adapter.go#L23-L50)
- [LocalBridge/internal/mfw/adapter.go:169-209](file://LocalBridge/internal/mfw/adapter.go#L169-L209)
- [LocalBridge/internal/mfw/adapter.go:723-731](file://LocalBridge/internal/mfw/adapter.go#L723-L731)

**章节来源**
- [LocalBridge/internal/mfw/adapter.go:52-703](file://LocalBridge/internal/mfw/adapter.go#L52-L703)
- [LocalBridge/internal/mfw/adapter.go:169-209](file://LocalBridge/internal/mfw/adapter.go#L169-L209)
- [LocalBridge/internal/mfw/reco_detail_helper.go:168-267](file://LocalBridge/internal/mfw/reco_detail_helper.go#L168-L267)
- [LocalBridge/internal/mfw/event_sink.go:61-71](file://LocalBridge/internal/mfw/event_sink.go#L61-L71)

### 调试协议与流程级控制
- 会话管理：创建/销毁/列出/获取会话，支持资源路径、控制器ID、Agent标识与事件回调。
- 调试控制：启动/运行/停止任务，支持入口节点与可选pipeline覆盖。
- 数据查询：获取节点JSON、截图（Base64）。
- 事件回传：统一事件格式，包含节点名、ID、任务ID、识别ID、动作ID、时间戳、延迟等。

```mermaid
sequenceDiagram
participant FE as "前端"
participant Debug as "调试协议处理器V2"
participant DS as "调试服务"
participant SA as "会话适配器"
participant FW as "MaaFramework"
FE->>Debug : "/mpe/debug/create_session"
Debug->>DS : CreateSessionWithOptions
DS->>SA : 创建会话适配器
SA->>FW : 绑定资源/控制器/Agent
SA-->>DS : 返回会话
DS-->>Debug : 返回session_id
Debug-->>FE : "/lte/debug/session_created"
FE->>Debug : "/mpe/debug/start"
Debug->>SA : RunTask(entry[, override])
SA->>FW : PostTask/Wait
FW-->>SA : 事件回传
SA-->>Debug : 事件
Debug-->>FE : "/lte/debug/event"
```

**图表来源**
- [LocalBridge/internal/protocol/debug/handler_v2.go:85-137](file://LocalBridge/internal/protocol/debug/handler_v2.go#L85-L137)
- [LocalBridge/internal/protocol/debug/handler_v2.go:227-294](file://LocalBridge/internal/protocol/debug/handler_v2.go#L227-L294)
- [LocalBridge/internal/protocol/debug/handler_v2.go:407-445](file://LocalBridge/internal/protocol/debug/handler_v2.go#L407-L445)

**章节来源**
- [LocalBridge/internal/protocol/debug/handler_v2.go:85-366](file://LocalBridge/internal/protocol/debug/handler_v2.go#L85-L366)

### 前端协议与数据交换
- 路由封装：提供设备刷新、控制器创建、操作下发、截图/OCR回调注册等方法。
- 状态管理：mfwStore维护连接状态、控制器类型与ID、设备列表、错误信息。
- 回调机制：对截图结果、OCR结果、图片路径解析、日志打开等事件注册回调，统一处理。
- **新增**：executeActionCallbacks数组管理直接动作执行回调。
- **macOS支持**：createMacOSController方法支持macOS原生应用控制器创建。
- **设备类型扩展**：支持六种设备类型（adb、win32、playcover、gamepad、wlroots、macos）。

**更新** 前端协议现在包含完整的macOS原生应用控制器创建支持，包括设备信息记录和连接状态管理。

**章节来源**
- [src/services/protocols/MFWProtocol.ts:273-773](file://src/services/protocols/MFWProtocol.ts#L273-L773)
- [src/stores/mfwStore.ts:70-157](file://src/stores/mfwStore.ts#L70-L157)
- [src/services/protocols/MFWProtocol.ts:25-26](file://src/services/protocols/MFWProtocol.ts#L25-L26)
- [src/services/protocols/MFWProtocol.ts:486-507](file://src/services/protocols/MFWProtocol.ts#L486-L507)

### 截图结果处理增强
**新增功能** 控制器管理器现在提供增强的截图结果处理机制：

- **详细错误反馈**：当截图作业失败时，返回包含具体错误信息的结果对象
- **作业验证机制**：在执行截图前验证作业状态，确保截图操作的有效性
- **完整结果结构**：包含控制器ID、成功标志、Base64图像数据、尺寸信息、时间戳和错误信息

```mermaid
flowchart TD
Start(["截图请求"]) --> Validate["验证控制器存在性和连接状态"]
Validate --> Exists{"控制器存在且已连接?"}
Exists --> |否| ReturnError["返回错误: 控制器不存在或未连接"]
Exists --> |是| SetParams["设置截图参数<br/>目标长边/短边/原始尺寸"]
SetParams --> UseCache{"使用缓存?"}
UseCache --> |是| GetCache["获取缓存图像"]
UseCache --> |否| PostJob["发布截图作业"]
PostJob --> WaitJob["等待作业完成"]
WaitJob --> CheckSuccess{"作业成功?"}
CheckSuccess --> |否| ReturnJobError["返回作业失败错误"]
CheckSuccess --> |是| GetImage["获取缓存图像"]
GetImage --> EncodeImage["编码为PNG并Base64"]
EncodeImage --> Success["返回成功结果"]
ReturnError --> End(["结束"])
ReturnJobError --> End
GetCache --> Success
Success --> End
```

**图表来源**
- [LocalBridge/internal/mfw/controller_manager.go:546-622](file://LocalBridge/internal/mfw/controller_manager.go#L546-L622)

**章节来源**
- [LocalBridge/internal/mfw/controller_manager.go:546-622](file://LocalBridge/internal/mfw/controller_manager.go#L546-L622)
- [LocalBridge/internal/mfw/types.go:72-90](file://LocalBridge/internal/mfw/types.go#L72-L90)
- [LocalBridge/internal/protocol/mfw/handler.go:413-447](file://LocalBridge/internal/protocol/mfw/handler.go#L413-L447)
- [src/services/protocols/MFWProtocol.ts:208-220](file://src/services/protocols/MFWProtocol.ts#L208-L220)

## 依赖关系分析
- 前端MFWProtocol依赖后端协议处理器与WebSocket连接；后端MFWHandler依赖MFW服务层；MFW服务层依赖各管理器与MaaFramework。
- 事件Sink与适配器配合，形成从MaaFramework到前端的事件回传闭环。
- 配置模块提供MaaFramework库路径与资源目录，影响初始化与资源加载。
- **新增** WebSocket路由系统提供动态路由管理和回调管理能力。
- **新增** macOS原生应用控制器支持完整的依赖链路，从设备发现到控制器管理再到MaaFramework集成。

```mermaid
graph LR
FE["MFWProtocol.ts"] --> WS["LocalWebSocketServer"]
FE --> PH["MFWHandler"]
FE --> DHV2["DebugHandlerV2"]
WS --> PH
WS --> DHV2
PH --> Svc["Service"]
DHV2 --> Svc
Svc --> DM["DeviceManager"]
Svc --> CM["ControllerManager"]
Svc --> RM["ResourceManager"]
Svc --> TM["TaskManager"]
CM --> FW["MaaFramework"]
RM --> FW
TM --> FW
AD["MaaFWAdapter"] --> FW
ES["EventSink"] --> FW
CFG["Config"] --> Svc
```

**图表来源**
- [src/services/protocols/MFWProtocol.ts:16-97](file://src/services/protocols/MFWProtocol.ts#L16-L97)
- [src/services/server.ts:20-100](file://src/services/server.ts#L20-L100)
- [LocalBridge/internal/protocol/mfw/handler.go:11-21](file://LocalBridge/internal/protocol/mfw/handler.go#L11-L21)
- [LocalBridge/internal/protocol/debug/handler_v2.go:16-28](file://LocalBridge/internal/protocol/debug/handler_v2.go#L16-L28)
- [LocalBridge/internal/mfw/service.go:15-23](file://LocalBridge/internal/mfw/service.go#L15-L23)
- [LocalBridge/internal/config/config.go:35-48](file://LocalBridge/internal/config/config.go#L35-L48)

**章节来源**
- [LocalBridge/internal/mfw/service.go:15-23](file://LocalBridge/internal/mfw/service.go#L15-L23)
- [LocalBridge/internal/config/config.go:35-48](file://LocalBridge/internal/config/config.go#L35-L48)

## 性能考虑
- 截图缓存：适配器与截图器均提供缓存策略（默认100ms），降低频繁截图带来的性能损耗。
- 连接超时：控制器连接采用异步等待+10秒超时，避免阻塞。
- 非活跃清理：定期清理长时间未活跃的控制器，释放资源。
- 多路径资源加载：支持多资源包叠加加载，按需加载以减少内存占用。
- 事件过滤：SimpleContextSink/SimpleTaskerSink仅上报关键事件，降低前端渲染与网络压力。
- **新增** WebSocket路由系统优化：基于Map的路由查找，O(1)时间复杂度，支持动态路由管理。
- **新增** macOS原生应用控制器优化：macOS控制器连接采用异步模式，支持超时控制和进程ID验证。
- **新增** 多平台控制器统一管理：通过统一的控制器管理器接口，支持五种控制器类型的统一管理。

**更新** 新增macOS原生应用控制器的性能优化，包括异步连接、进程ID验证和统一的控制器管理接口。

## 故障排查指南
- 未初始化：若未设置MaaFramework库路径，后端会拒绝请求并返回"未初始化"错误，需通过配置命令设置库路径并重启服务。
- 控制器创建/连接失败：检查设备/窗口参数、方法列表、ADB代理与权限；查看连接超时与UUID获取失败。
- **macOS连接失败**：检查进程ID有效性、应用权限设置、截图方法配置；确认应用具有辅助功能权限。
- **WlRoots连接失败**：检查socket路径有效性、Wayland合成器状态、权限设置；确认WlRoots在Linux环境下运行。
- 截图失败：检查截图参数（目标长/短边、原始尺寸、缓存）、控制器连接状态与MaaFramework截图能力。现在可以查看详细的错误信息来诊断问题。
- 任务提交/停止失败：确认Tasker已初始化、控制器与资源已绑定；检查任务状态与是否存在。
- 资源加载失败：检查资源路径、Windows非ASCII路径处理与工作目录切换逻辑。
- 事件缺失：确认已注册事件Sink并处于启用状态；检查事件过滤逻辑与前端回调订阅。
- **新增** 直接动作执行失败：检查资源是否已加载，当前实现需要Resource支持，暂未完全实现。
- **新增** WebSocket路由错误：检查路由注册是否正确，回调函数是否正确注销。
- **新增** 设备类型识别失败：确认设备类型字符串匹配（adb、win32、playcover、gamepad、wlroots、macos）。

**更新** 新增macOS相关的故障排查指导，包括进程ID验证、应用权限设置、截图方法配置等问题的解决方案。

**章节来源**
- [LocalBridge/internal/protocol/mfw/handler.go:33-41](file://LocalBridge/internal/protocol/mfw/handler.go#L33-L41)
- [LocalBridge/internal/mfw/error.go:5-31](file://LocalBridge/internal/mfw/error.go#L5-L31)
- [LocalBridge/internal/mfw/controller_manager.go:249-300](file://LocalBridge/internal/mfw/controller_manager.go#L249-L300)
- [LocalBridge/internal/mfw/resource_manager.go:26-105](file://LocalBridge/internal/mfw/resource_manager.go#L26-L105)
- [LocalBridge/internal/mfw/task_manager.go:68-90](file://LocalBridge/internal/mfw/task_manager.go#L68-L90)
- [LocalBridge/internal/mfw/device_manager.go:98-112](file://LocalBridge/internal/mfw/device_manager.go#L98-L112)

## 结论
MFW协议通过清晰的分层设计与严格的生命周期管理，实现了与MaaFramework的稳定集成。前端通过WebSocket协议与后端交互，后端以协议处理器为核心，串联服务层与MaaFramework，提供设备发现、控制器操作、资源加载、任务执行与调试回传等能力。结合事件过滤、缓存策略与超时控制，整体具备良好的稳定性与可维护性。

**更新** 最新更新完成了macOS原生应用控制器的完整支持，现支持五种控制器类型（ADB、Win32、PlayCover、Gamepad、macOS原生），显著扩展了跨平台设备控制能力。新增的注释修正和方法签名更新进一步提升了代码的可读性和维护性。

## 附录

### 通信协议与数据交换格式
- 路由前缀
  - MFW协议：/etl/mfw/*
  - 调试协议V2：/mpe/debug/*
- 常用消息
  - 设备列表：/etl/mfw/refresh_adb_devices → /lte/mfw/adb_devices
  - **macOS应用**：/etl/mfw/refresh_macos_apps → /lte/mfw/macos_apps
  - **WlRoots设备**：/etl/mfw/refresh_wlroots_sockets → /lte/mfw/wlroots_sockets
  - 控制器创建：/etl/mfw/create_*_controller → /lte/mfw/controller_created
  - 控制器状态：/lte/mfw/controller_status
  - 截图：/etl/mfw/request_screencap → /lte/mfw/screencap_result
  - OCR：/etl/utility/ocr_recognize → /lte/utility/ocr_result
  - 资源加载：/etl/mfw/load_resource → /lte/mfw/resource_loaded
  - 任务：/etl/mfw/submit_task → /lte/mfw/task_submitted；/etl/mfw/query_task_status → /lte/mfw/task_status
  - **新增** 直接动作执行：/etl/mfw/execute_action → /lte/mfw/execute_action_result
- 数据结构要点
  - 控制器操作结果：包含控制器ID、操作类型、成功标志、状态与可选错误。
  - 截图结果：包含控制器ID、成功标志、Base64 PNG、宽高、时间戳和错误信息。
  - 设备信息：包含方法列表（截图/输入），供前端选择。
  - 任务信息：包含任务ID、控制器ID、资源ID、入口、覆盖参数与状态。
  - **新增** macOS设备信息：包含pid字段，记录macOS应用进程ID。
  - **新增** WlRoots设备信息：包含socket_path字段，记录Wayland合成器的socket路径。
  - **新增** 直接动作执行结果：包含成功标志、错误信息和可选结果数据。

**更新** 新增macOS设备信息的数据结构支持，包括pid字段的定义和使用。更新了直接动作执行的路由和数据结构支持。

**章节来源**
- [LocalBridge/internal/protocol/mfw/handler.go:24-117](file://LocalBridge/internal/protocol/mfw/handler.go#L24-L117)
- [LocalBridge/internal/mfw/types.go:40-49](file://LocalBridge/internal/mfw/types.go#L40-L49)
- [LocalBridge/internal/mfw/types.go:72-124](file://LocalBridge/internal/mfw/types.go#L72-L124)
- [src/services/protocols/MFWProtocol.ts:105-141](file://src/services/protocols/MFWProtocol.ts#L105-L141)
- [src/services/protocols/MFWProtocol.ts:486-507](file://src/services/protocols/MFWProtocol.ts#L486-L507)
- [src/services/protocols/MFWProtocol.ts:864-904](file://src/services/protocols/MFWProtocol.ts#L864-L904)