# maafw-golang 核心概念

<cite>
**本文引用的文件列表**
- [README.md](file://README.md)
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md)
- [instructions/maafw-golang-binding/API参考/框架初始化.md](file://instructions/maafw-golang-binding/API参考/框架初始化.md)
- [instructions/maafw-golang-binding/API参考/事件系统.md](file://instructions/maafw-golang-binding/API参考/事件系统.md)
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md)
- [instructions/maafw-golang-binding/API参考/执行上下文.md](file://instructions/maafw-golang-binding/API参考/执行上下文.md)
- [instructions/maafw-golang-binding/API参考/控制器.md](file://instructions/maafw-golang-binding/API参考/控制器.md)
- [instructions/maafw-golang-binding/API参考/资源管理器.md](file://instructions/maafw-golang-binding/API参考/资源管理器.md)
- [instructions/maafw-golang-binding/高级功能/Agent架构/Agent架构.md](file://instructions/maafw-golang-binding/高级功能/Agent架构/Agent架构.md)
- [instructions/maafw-golang-binding/示例与用例/快速开始示例.md](file://instructions/maafw-golang-binding/示例与用例/快速开始示例.md)
- [instructions/maafw-golang-binding/示例与用例/Agent客户端示例.md](file://instructions/maafw-golang-binding/示例与用例/Agent客户端示例.md)
- [instructions/maafw-golang-binding/示例与用例/Agent服务器示例.md](file://instructions/maafw-golang-binding/示例与用例/Agent服务器示例.md)
- [src/App.tsx](file://src/App.tsx)
- [package.json](file://package.json)
- [instructions/maafw-golang-binding/核心概念/任务管理器 (Tasker).md](file://instructions/maafw-golang-binding/核心概念/任务管理器 (Tasker).md)
- [instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md](file://instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md)
- [instructions/maafw-golang-binding/核心概念/事件系统重构.md](file://instructions/maafw-golang-binding/核心概念/事件系统重构.md)
- [instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md](file://instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md)
- [instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md](file://instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md)
</cite>

## 更新摘要
**变更内容**
- 新增 `PostRecognition` 和 `PostAction` 方法的详细说明
- 扩展“任务生命周期”章节以涵盖直接提交识别与动作任务的功能
- 更新架构总览序列图以反映新增方法
- 增加新的组件详解小节“直接提交识别与动作任务”
- 更新类图以包含新增方法
- **新增“事件系统重构”章节，详细说明事件系统从代码生成到手写适配器模式的重构**
- **新增“PlayCover控制器”章节，介绍针对iOS设备上PlayCover应用的专用控制器**
- **新增“基于节点的流水线系统”章节，阐述基于节点的声明式任务流架构**

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 引言
本篇文档围绕 maa-framework-go 的核心概念与组件进行系统性阐述，目标是帮助开发者建立坚实的理论基础，理解 Tasker（任务调度中枢）、Resource（识别资源与流水线配置）、Controller（设备控制抽象，支持 ADB/Win32/自定义）、Context（任务执行上下文）、Event（事件回调系统）之间的协作关系与内部工作机制。文档同时结合代码库中的具体实现（如 NewTasker、PostTask、PostBundle 等），并通过图示展示组件间的数据流与依赖关系，并总结常见误用与最佳实践。**本次更新重点反映了事件系统重构、PlayCover控制器和基于节点的流水线系统等新功能。**

## 项目结构
该仓库采用按职责分层的组织方式：
- 核心 API 层：tasker.go、resource.go、controller.go、context.go、event.go、job.go
- 自定义扩展层：custom_action.go、custom_recognition.go
- 示例层：examples 下包含快速开始、自定义动作、自定义识别、Agent 客户端/服务器等示例
- 内部工具与桥接：internal 目录下的缓冲区、原生桥接、存储等

```mermaid
graph TB
subgraph "核心API层"
T["Tasker<br/>任务调度中枢"]
R["Resource<br/>资源与流水线配置"]
C["Controller<br/>设备控制抽象"]
X["Context<br/>执行上下文"]
E["Event<br/>事件回调系统"]
J["Job/TaskJob<br/>异步作业模型"]
end
subgraph "扩展层"
CA["CustomAction<br/>自定义动作"]
CR["CustomRecognition<br/>自定义识别"]
end
subgraph "示例"
QS["quick-start 示例"]
CAE["custom-action 示例"]
CRE["custom-recognition 示例"]
ACS["agent-client 示例"]
ASS["agent-server 示例"]
end
T --> R
T --> C
X --> T
E --> T
E --> R
E --> C
E --> X
J --> T
J --> R
J --> C
CA --> R
CR --> R
QS --> T
QS --> R
QS --> C
CAE --> T
CAE --> R
CRE --> T
CRE --> R
ACS --> T
ACS --> R
ACS --> C
ASS --> T
ASS --> R
ASS --> C
```

**章节来源**
- [README.md](file://README.md#L30-L72)

## 核心组件
- Tasker：负责任务提交、状态查询、停止信号、事件回调注册、节点详情查询等，是任务执行的中枢。
- Resource：负责资源加载、流水线覆盖、自定义识别/动作注册、事件回调注册等，承载识别与动作的配置与能力。
- Controller：负责设备连接、截图、输入、应用启停、滚动等操作，抽象出 ADB/Win32/自定义控制器。
- Context：提供在单次任务执行中运行识别/动作的能力，支持覆盖流水线、锚点、命中计数等上下文级操作。
- Event：统一的事件回调代理与分发器，将底层事件映射到 Tasker/Resource/Controller/Context 的回调接口。
- Job/TaskJob：封装异步作业的状态查询与等待逻辑，TaskJob 还可获取任务详情。

**章节来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L84-L100)

## 架构总览
下图展示了从应用调用到底层原生交互的关键路径，以及事件回调的分发链路。

```mermaid
sequenceDiagram
participant App as "应用"
participant Tasker as "Tasker"
participant Res as "Resource"
participant Ctrl as "Controller"
participant Ctx as "Context"
participant Ev as "Event回调"
participant Native as "原生MaaFramework"
App->>Tasker : "创建并绑定资源/控制器"
App->>Tasker : "PostTask(...)"
Tasker->>Native : "提交任务"
Native-->>Ev : "触发事件(任务开始/成功/失败)"
Ev->>Tasker : "TaskerEventSink回调"
Ev->>Res : "ResourceEventSink回调"
Ev->>Ctrl : "ControllerEventSink回调"
Ev->>Ctx : "ContextEventSink回调"
Tasker->>Tasker : "查询任务详情/节点详情"
App->>Tasker : "Wait()/GetDetail()"
Tasker-->>App : "返回任务结果"
```

**图示来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L100-L134)

**章节来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L100-L134)

## 详细组件分析

### Tasker 组件
- 职责
  - 创建销毁、初始化检查、缓存清理
  - 绑定 Resource 与 Controller
  - 提交任务、停止任务、查询状态与等待完成
  - 查询任务详情、节点详情、最新节点
  - 注册/移除/清空事件回调（Tasker/Context 两类 Sink）
- 关键方法与行为
  - NewTasker：创建句柄并登记到全局存储，用于后续回调注销与资源回收
  - PostTask：支持字符串或任意可 JSON 序列化的覆盖参数；内部将覆盖参数序列化后传递给原生
  - PostStop：向任务器发送停止信号
  - AddSink/RemoveSink/ClearSinks：注册 TaskerEventSink 回调，保存映射以便销毁时注销
  - AddContextSink/RemoveContextSink/ClearContextSinks：注册 ContextEventSink 回调
  - 任务详情查询：getTaskDetail/getNodeDetail/getRecognitionDetail/getActionDetail
- 数据流
  - 任务提交后由原生执行，期间通过事件回调异步通知上层
  - 任务完成后可通过 Wait 获取最终状态，再通过 GetDetail 获取详细信息

```mermaid
classDiagram
class Tasker {
+handle uintptr
+NewTasker() *Tasker
+Destroy() void
+BindResource(res) bool
+BindController(ctrl) bool
+Initialized() bool
+PostTask(entry, override...) *TaskJob
+PostStop() *TaskJob
+Running() bool
+Stopping() bool
+GetResource() *Resource
+GetController() *Controller
+ClearCache() bool
+AddSink(sink) int64
+RemoveSink(id) void
+ClearSinks() void
+AddContextSink(sink) int64
+RemoveContextSink(id) void
+ClearContextSinks() void
+GetLatestNode(taskName) *NodeDetail
}
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md#L150-L206)

**章节来源**
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md#L150-L206)
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md#L206-L234)

### Resource 组件
- 职责
  - 创建销毁、加载资源包、查询加载状态、获取哈希与节点列表
  - 流水线覆盖、下一跳覆盖、图像覆盖
  - 注册/注销/清空自定义识别与自定义动作
  - 注册/移除/清空事件回调（ResourceEventSink）
- 关键方法与行为
  - NewResource：创建句柄并登记到全局存储
  - PostBundle：添加资源路径并返回 Job，支持异步等待
  - OverridePipeline：支持字符串或任意可 JSON 序列化的覆盖参数
  - OverrideNext：按任务名覆盖下一跳列表
  - OverrideImage：覆盖指定图像
  - RegisterCustomRecognition/RegisterCustomAction：注册自定义识别/动作，保存回调ID映射
  - AddSink/RemoveSink/ClearSinks：注册 ResourceEventSink 回调
- 数据流
  - 资源加载完成后，可通过 Loaded 检查状态；节点列表与自定义项可通过相应接口查询

```mermaid
classDiagram
class Resource {
+handle uintptr
+NewResource() *Resource
+Destroy() void
+PostBundle(path) *Job
+OverridePipeline(override) bool
+OverrideNext(name, nextList) bool
+OverrideImage(name, image) bool
+GetNodeJSON(name) (string, bool)
+GetNodeList() ([]string, bool)
+GetCustomRecognitionList() ([]string, bool)
+GetCustomActionList() ([]string, bool)
+RegisterCustomRecognition(name, rec) bool
+UnregisterCustomRecognition(name) bool
+ClearCustomRecognition() bool
+RegisterCustomAction(name, act) bool
+UnregisterCustomAction(name) bool
+ClearCustomAction() bool
+AddSink(sink) int64
+RemoveSink(id) void
+ClearSinks() void
+Loaded() bool
+GetHash() (string, bool)
}
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/资源管理器.md](file://instructions/maafw-golang-binding/API参考/资源管理器.md#L221-L271)

**章节来源**
- [instructions/maafw-golang-binding/API参考/资源管理器.md](file://instructions/maafw-golang-binding/API参考/资源管理器.md#L140-L210)

### Controller 组件
- 职责
  - 创建 ADB/Win32/自定义控制器实例
  - 设备连接、截图、点击、滑动、按键、输入文本、启动/停止应用、触摸/滚动等
  - 选项设置（如截图目标长边/短边、是否使用原始尺寸）
  - 缓存最近一次截图图像、获取 UUID
  - 注册/移除/清空事件回调（ControllerEventSink）
- 关键方法与行为
  - NewAdbController/NewWin32Controller/NewCustomController：三种构造方式
  - PostConnect/PostClick/PostSwipe/PostInputText/PostStartApp/PostStopApp/PostTouchDown/PostTouchMove/PostTouchUp/PostKeyDown/PostKeyUp/PostScreencap/PostScroll：各类设备操作
  - SetScreenshotTargetLongSide/SetScreenshotTargetShortSide/SetScreenshotUseRawSize：截图尺寸相关选项
  - CacheImage/GetUUID：读取缓存图像与设备 UUID
  - AddSink/RemoveSink/ClearSinks：注册 ControllerEventSink 回调
- 数据流
  - 控制器通过原生接口执行设备操作，期间通过事件回调异步通知上层

```mermaid
classDiagram
class Controller {
+handle uintptr
+NewAdbController(...) *Controller
+NewWin32Controller(...) *Controller
+NewCustomController(ctrl) *Controller
+Destroy() void
+PostConnect() *Job
+PostClick(x,y) *Job
+PostSwipe(x1,y1,x2,y2,duration) *Job
+PostInputText(text) *Job
+PostStartApp(intent) *Job
+PostStopApp(intent) *Job
+PostTouchDown(contact,x,y,pressure) *Job
+PostTouchMove(contact,x,y,pressure) *Job
+PostTouchUp(contact) *Job
+PostKeyDown(keycode) *Job
+PostKeyUp(keycode) *Job
+PostScreencap() *Job
+PostScroll(dx,dy) *Job
+SetScreenshotTargetLongSide(target) bool
+SetScreenshotTargetShortSide(target) bool
+SetScreenshotUseRawSize(enabled) bool
+Connected() bool
+CacheImage() image.Image
+GetUUID() (string, bool)
+AddSink(sink) int64
+RemoveSink(id) void
+ClearSinks() void
}
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/控制器.md](file://instructions/maafw-golang-binding/API参考/控制器.md#L236-L300)

**章节来源**
- [instructions/maafw-golang-binding/API参考/控制器.md](file://instructions/maafw-golang-binding/API参考/控制器.md#L118-L182)

### Context 组件
- 职责
  - 在当前上下文中运行任务、识别、动作，并返回详细结果
  - 支持覆盖流水线、下一跳、图像覆盖
  - 获取节点 JSON、克隆上下文、设置/获取锚点、统计命中次数
  - 获取当前任务作业、当前 Tasker 实例
- 关键方法与行为
  - RunTask/RunRecognition/RunAction：在上下文中执行对应步骤，内部将覆盖参数序列化后传递给原生
  - OverridePipeline/OverrideNext/OverrideImage：覆盖上下文级配置
  - GetNodeJSON/GetNodeData：获取节点 JSON 并解析为结构化对象
  - GetTaskJob/GetTasker/Clone：获取当前任务作业、Tasker 或克隆上下文
  - SetAnchor/GetAnchor/GetHitCount/ClearHitCount：锚点与命中计数管理
- 数据流
  - 上下文通过 Tasker 执行任务，再由 Tasker 返回任务详情供 Context 使用

```mermaid
flowchart TD
Start(["进入 Context 方法"]) --> BuildOverride["构建覆盖参数(JSON)"]
BuildOverride --> CallNative["调用原生执行(任务/识别/动作)"]
CallNative --> GetTasker["获取 Tasker 句柄"]
GetTasker --> QueryDetail["查询任务/识别/动作详情"]
QueryDetail --> Return(["返回结果"])
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/执行上下文.md](file://instructions/maafw-golang-binding/API参考/执行上下文.md#L300-L340)

**章节来源**
- [instructions/maafw-golang-binding/API参考/执行上下文.md](file://instructions/maafw-golang-binding/API参考/执行上下文.md#L300-L340)

### Event 系统（观察者模式）
- 职责
  - 统一的事件回调注册与注销
  - 将底层事件消息映射到 Tasker/Resource/Controller/Context 的回调接口
  - 事件状态（Starting/Succeeded/Failed/Unknown）解析
- 关键机制
  - registerEventCallback/unregisterEventCallback：维护回调 ID 到 sink 的映射
  - _MaaEventCallbackAgent：原生回调入口，根据 transArg 查找 sink 并分发
  - eventHandler.handleRaw：根据消息前缀路由到对应回调接口
- 模式体现
  - 观察者模式：各组件通过 AddSink 注册回调，事件发生时异步通知
  - 适配器思想：将底层通用回调适配为不同组件的特定接口

```mermaid
sequenceDiagram
participant Native as "原生事件"
participant Agent as "_MaaEventCallbackAgent"
participant Store as "回调存储"
participant Sink as "具体回调(sink)"
Native->>Agent : "传入(handle,message,details,transArg)"
Agent->>Store : "根据transArg查找回调ID"
Store-->>Agent : "返回sink"
Agent->>Sink : "调用对应回调(带事件状态与详情)"
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/事件系统.md](file://instructions/maafw-golang-binding/API参考/事件系统.md#L344-L373)

**章节来源**
- [instructions/maafw-golang-binding/API参考/事件系统.md](file://instructions/maafw-golang-binding/API参考/事件系统.md#L331-L373)

### Job/TaskJob（异步作业模型）
- 职责
  - 封装异步作业的状态查询与等待
  - TaskJob 在 Job 基础上增加获取任务详情的能力
- 关键方法
  - Status/Done/Wait：查询状态、等待完成
  - TaskJob.GetDetail：获取任务详情

```mermaid
classDiagram
class Job {
-id int64
-finalStatus Status
-statusFunc(id) Status
-waitFunc(id) Status
+Status() Status
+Invalid() bool
+Pending() bool
+Running() bool
+Success() bool
+Failure() bool
+Done() bool
+Wait() *Job
}
class TaskJob {
+Job *Job
-getTaskDetailFunc(id) *TaskDetail
+Wait() *TaskJob
+GetDetail() *TaskDetail
}
TaskJob --|> Job
```

**图示来源**
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md#L365-L401)

**章节来源**
- [instructions/maafw-golang-binding/API参考/任务管理器.md](file://instructions/maafw-golang-binding/API参考/任务管理器.md#L365-L401)

### 直接提交识别与动作任务
- **PostRecognition**：直接提交识别任务，接收识别类型、参数和图像，返回 TaskJob 用于状态查询和等待。适用于需要独立执行识别操作的场景。
- **PostAction**：直接提交动作任务，接收动作类型、参数、目标区域和识别结果，返回 TaskJob。适用于需要独立执行动作操作的场景。
- **灵活性**：这两个方法提供了比 PostTask 更细粒度的控制，允许开发者在不定义完整任务流程的情况下执行特定的识别或动作。
- **参数处理**：识别参数和动作参数会被序列化为 JSON 字符串，识别结果详情也会被序列化后传递给原生接口。

```mermaid
sequenceDiagram
participant U as "用户代码"
participant T as "Tasker"
participant N as "原生框架"
U->>T : PostRecognition(类型, 参数, 图像)
T->>N : 调用MaaTaskerPostRecognition
N-->>U : 返回TaskJob
U->>T : PostAction(类型, 参数, 区域, 识别结果)
T->>N : 调用MaaTaskerPostAction
N-->>U : 返回TaskJob
```

**图表来源**
- [tasker.go](file://tasker.go#L102-L124)
- [internal/native/framework.go](file://internal/native/framework.go#L35-L36)

**章节来源**
- [tasker.go](file://tasker.go#L102-L124)

### 工厂模式与门面模式的应用
- 工厂模式
  - Tasker/Resource/Controller 的构造函数分别负责创建不同类型的实例（NewTasker、NewResource、NewAdbController、NewWin32Controller、NewCustomController），体现了工厂模式的“创建型”特征
- 门面模式
  - Context 对外提供 RunTask/RunRecognition/RunAction 等高层接口，隐藏了底层 Tasker 的细节，形成简洁易用的门面
  - Tasker/Resource/Controller 的多数方法也起到简化调用的作用，便于上层以统一方式使用

**章节来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L404-L416)

### 事件系统重构
**章节来源**
- [instructions/maafw-golang-binding/核心概念/事件系统重构.md](file://instructions/maafw-golang-binding/核心概念/事件系统重构.md)
- [instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md](file://instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md)

事件系统已进行重构，主要变化如下：
- **移除代码生成**：不再使用 `tools/gen-event-sink` 工具生成事件接口和适配器，改为手写实现，提高了代码的可读性和可维护性。
- **引入手写适配器**：通过 `*EventSinkAdapter` 结构体（如 `TaskerEventSinkAdapter`）实现适配器模式，简化了单事件回调的注册。
- **简化分发逻辑**：事件分发逻辑更加清晰，移除了 `event_sinks_gen.go` 文件，降低了系统复杂性。
- **统一注册入口**：保留了 `AddSink`/`RemoveSink` 等统一的注册入口，但内部实现更简洁，通过全局映射表管理回调ID。

```mermaid
classDiagram
class TaskerEventSink {
<<interface>>
+OnTaskerTask(tasker *Tasker, event EventStatus, detail TaskerTaskDetail)
}
class TaskerEventSinkAdapter {
-onTaskerTask func(EventStatus, TaskerTaskDetail)
+OnTaskerTask(tasker *Tasker, status EventStatus, detail TaskerTaskDetail)
}
TaskerEventSinkAdapter ..|> TaskerEventSink
```

**图示来源**
- [instructions/maafw-golang-binding/核心概念/事件系统重构.md](file://instructions/maafw-golang-binding/核心概念/事件系统重构.md#L117-L140)
- [instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md](file://instructions/maafw-golang-binding/核心概念/事件系统 (Event System).md#L174-L205)

### PlayCover控制器
**章节来源**
- [instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md](file://instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md)

PlayCover控制器是专为与macOS上运行的iOS应用（通过PlayCover兼容层）进行交互而设计的控制器。
- **创建方式**：通过 `NewPlayCoverController(address, uuid string)` 创建，需要提供PlayCover应用的地址和控制器的唯一标识符。
- **核心功能**：支持连接管理、输入操作（点击、滑动、文本输入）、屏幕截图、应用管理（启动/停止）和事件回调。
- **异步操作**：所有操作（如 `PostClick`, `PostSwipe`）均返回 `Job` 实例，采用异步模式执行。
- **事件回调**：通过 `AddSink` 方法注册 `ControllerEventSink`，监听控制器的动作状态变化。

```mermaid
classDiagram
class Controller {
+handle uintptr
+NewPlayCoverController(address, uuid string) *Controller
+Destroy()
+PostConnect() *Job
+PostClick(x, y int32) *Job
+PostSwipe(x1, y1, x2, y2 int32, duration time.Duration) *Job
+PostInputText(text string) *Job
+PostScreencap() *Job
+Connected() bool
+CacheImage() image.Image
+GetUUID() (string, bool)
+AddSink(sink ControllerEventSink) int64
}
```

**图示来源**
- [instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md](file://instructions/maafw-golang-binding/核心概念/控制器 (Controller)/PlayCover控制器.md#L100-L133)

### 基于节点的流水线系统
**章节来源**
- [instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md](file://instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md)

该系统采用声明式任务流与JSON配置相结合的方式，构建了基于节点的自动化任务执行流程。
- **核心组件**：
  - **节点 (Node)**：流水线的基本执行单元，包含识别、动作、跳转逻辑等配置。
  - **流水线 (Pipeline)**：节点的集合，定义了任务的完整流程。
  - **任务器 (Tasker)**：负责任务的调度和执行，协调资源与控制器。
- **架构设计**：系统采用分层架构，上层为用户应用，中层为框架（Tasker, Context, Pipeline, Node），下层为资源（Resource）和控制器（Controller）。
- **扩展性**：支持通过 `RegisterCustomAction` 和 `RegisterCustomRecognition` 注册自定义动作和识别算法，极大地增强了框架的灵活性。

```mermaid
graph TB
subgraph "用户层"
A[应用程序]
end
subgraph "框架层"
B[Tasker]
C[Context]
D[Pipeline]
E[Node]
end
subgraph "资源层"
F[Resource]
G[Controller]
end
A --> B
B --> C
C --> D
D --> E
B --> F
B --> G
F --> H[(资源文件)]
G --> I[(目标设备)]
```

**图示来源**
- [instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md](file://instructions/maafw-golang-binding/高级功能/基于节点的流水线系统.md#L96-L119)

## 依赖关系分析
- 组件耦合
  - Tasker 依赖 Resource 与 Controller（绑定与查询）
  - Context 依赖 Tasker（获取任务详情、当前任务作业）
  - Event 系统为 Tasker/Resource/Controller/Context 提供统一的回调入口
  - Job/TaskJob 为 Tasker/Resource/Controller 的异步操作提供统一的状态查询与等待
- 外部依赖
  - 通过 internal/native 与原生 MaaFramework 交互
  - 通过 internal/store 维护句柄到回调映射与自定义识别/动作的回调 ID 映射

```mermaid
graph LR
Tasker["Tasker"] --> Resource["Resource"]
Tasker --> Controller["Controller"]
Context["Context"] --> Tasker
Event["Event回调"] --> Tasker
Event --> Resource
Event --> Controller
Event --> Context
Job["Job/TaskJob"] --> Tasker
Job --> Resource
Job --> Controller
```

**图示来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L417-L449)

**章节来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L417-L449)

## 性能考量
- 异步作业模型
  - 使用 Job/TaskJob 避免阻塞主线程，提高吞吐量
- 缓存与复用
  - Tasker/Resource/Controller 在销毁时会注销所有回调，避免内存泄漏
  - Context 提供 Clone，可在需要时复制上下文以减少重复配置
- 图像与缓冲
  - 识别与动作过程中大量使用图像缓冲，注意及时释放缓冲区，避免内存占用过高
- 事件回调
  - 回调注册/注销需成对出现，避免回调表膨胀导致性能下降

[本节为通用建议，不直接分析具体文件]

## 故障排查指南
- 初始化失败
  - 确认已正确初始化并配置运行库路径
  - 检查 Tasker/Resource/Controller 的初始化状态与错误返回值
- 事件未回调
  - 确认已正确注册 AddSink/RemoveSink，且回调 ID 未被重复使用
  - 检查事件消息前缀与回调类型匹配
- 任务无结果
  - 使用 Wait() 等待完成后再调用 GetDetail()
  - 检查 OverridePipeline/OverrideNext/OverrideImage 是否正确覆盖
- 设备连接问题
  - 确认 PostConnect 成功，Connected() 返回真
  - 检查截图尺寸设置与缓存图像是否可用

**章节来源**
- [instructions/maafw-golang-binding/核心概念/核心概念.md](file://instructions/maafw-golang-binding/核心概念/核心概念.md#L470-L490)

## 结论
maa-framework-go 通过 Tasker、Resource、Controller、Context、Event 与 Job/TaskJob 的协同，构建了一个清晰、可扩展且高性能的自动化框架。Tasker 作为中枢协调任务执行，Resource 管理识别资源与流水线，Controller 抽象设备控制，Context 提供上下文级的执行能力，Event 以观察者模式实现异步通知，Job/TaskJob 则提供了统一的异步作业模型。工厂模式与门面模式的应用使得 API 更加简洁易用。**本次更新引入的事件系统重构、PlayCover控制器和基于节点的流水线系统，进一步增强了框架的可维护性、平台支持能力和任务编排的灵活性。** 遵循本文的最佳实践与排错建议，可有效提升开发效率与稳定性。

## 附录
- 快速开始示例展示了从初始化、设备连接、资源加载到任务执行的完整流程
- 自定义动作与识别示例展示了如何扩展识别与动作能力
- Agent 客户端/服务器示例展示了跨进程协作的工作流

**章节来源**
- [instructions/maafw-golang-binding/示例与用例/快速开始示例.md](file://instructions/maafw-golang-binding/示例与用例/快速开始示例.md#L360-L369)
- [instructions/maafw-golang-binding/示例与用例/Agent客户端示例.md](file://instructions/maafw-golang-binding/示例与用例/Agent客户端示例.md#L378-L391)
- [instructions/maafw-golang-binding/示例与用例/Agent服务器示例.md](file://instructions/maafw-golang-binding/示例与用例/Agent服务器示例.md#L388-L411)