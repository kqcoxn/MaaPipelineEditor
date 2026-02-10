# 控制器（Controller）

<cite>
**本文引用的文件列表**
- [controller.go](file://controller.go)
- [custom_controller.go](file://custom_controller.go)
- [dbg_controller.go](file://dbg_controller.go)
- [controller\adb\adb.go](file://controller\adb\adb.go)
- [controller\win32\win32.go](file://controller\win32\win32.go)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go)
- [internal\native\native.go](file://internal\native\native.go)
- [internal\native\framework.go](file://internal\native\framework.go)
- [internal\store\store.go](file://internal\store\store.go)
- [controller_test.go](file://controller_test.go)
- [examples\quick-start\main.go](file://examples\quick-start\main.go)
- [examples\agent-client\main.go](file://examples\agent-client\main.go)
</cite>

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [组件详解](#组件详解)
6. [依赖关系分析](#依赖关系分析)
7. [性能与延迟考量](#性能与延迟考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录：平台示例与配置建议](#附录平台示例与配置建议)

## 引言
本章节系统性介绍控制器（Controller）的抽象设计及其在设备控制中的关键角色。控制器作为上层任务编排与底层设备交互之间的桥梁，统一对外暴露一致的操作接口，屏蔽平台差异。本文将重点阐述：
- 抽象控制器的设计理念与职责边界
- ADB 控制器、Win32 控制器、虚拟游戏pad控制器和调试控制器的创建方式与参数含义
- 统一的跨平台操作接口（如 PostClick、PostSwipe、PostClickV2、PostSwipeV2、PostScreencap 等）
- 与底层原生库的交互机制（通过 native 层函数桥接）
- 设备连接、屏幕捕获、输入模拟的完整流程
- 连接管理、异常重试、性能延迟等实际问题的解决方案与配置建议
- **新增**：调试控制器CarouselImageController和BlankController的使用场景

## 项目结构
控制器相关代码主要分布在以下位置：
- 核心控制器封装：controller.go
- 自定义控制器回调桥接：custom_controller.go
- 调试控制器实现：dbg_controller.go
- 平台方法枚举与解析：controller/adb/adb.go、controller/win32/win32.go、controller/gamepad/gamepad.go
- 原生库绑定与导出函数：internal/native/framework.go；初始化入口：internal/native/native.go
- 存储与回调映射：internal/store/store.go
- 使用示例与测试：examples/quick-start/main.go、examples/agent-client/main.go、controller_test.go

```mermaid
graph TB
subgraph "Go 层"
C["Controller<br/>controller.go"]
ADB["ADB 方法枚举<br/>controller/adb/adb.go"]
WIN["Win32 方法枚举<br/>controller/win32/win32.go"]
GAMEPAD["游戏pad按钮映射<br/>controller/gamepad/gamepad.go"]
CC["自定义控制器回调<br/>custom_controller.go"]
DBG["调试控制器<br/>dbg_controller.go"]
NATIVE["原生函数绑定<br/>internal/native/framework.go"]
STORE["句柄存储与回调映射<br/>internal/store/store.go"]
end
subgraph "示例与测试"
EX1["快速开始示例<br/>examples/quick-start/main.go"]
EX2["Agent客户端示例<br/>examples/agent-client/main.go"]
TEST["控制器测试<br/>controller_test.go"]
end
C --> NATIVE
C --> STORE
ADB --> C
WIN --> C
GAMEPAD --> C
CC --> C
DBG --> CC
EX1 --> C
EX2 --> C
TEST --> C
```

**图表来源**
- [controller.go](file://controller.go#L1-L512)
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [custom_controller.go](file://custom_controller.go#L1-L436)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)
- [internal\native\framework.go](file://internal\native\framework.go#L1-L511)
- [internal\store\store.go](file://internal\store\store.go#L1-L65)
- [examples\quick-start\main.go](file://examples\quick-start\main.go#L1-L41)
- [examples\agent-client\main.go](file://examples\agent-client\main.go#L1-L72)
- [controller_test.go](file://controller_test.go#L1-L220)

**章节来源**
- [controller.go](file://controller.go#L1-L512)
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [custom_controller.go](file://custom_controller.go#L1-L436)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)
- [internal\native\native.go](file://internal\native\native.go#L1-L41)
- [internal\native\framework.go](file://internal\native\framework.go#L1-L511)
- [internal\store\store.go](file://internal\store\store.go#L1-L65)
- [examples\quick-start\main.go](file://examples\quick-start\main.go#L1-L41)
- [examples\agent-client\main.go](file://examples\agent-client\main.go#L1-L72)
- [controller_test.go](file://controller_test.go#L1-L220)

## 核心组件
- 抽象控制器 Controller
  - 负责统一的设备控制接口，包括连接、点击、滑动、输入文本、启动/停止应用、触摸、按键、滚动、截图等
  - 通过原生函数桥接到底层设备驱动或模拟器 API
  - 提供异步作业模型（PostXxx 返回 Job，支持 Wait/Status 查询）
  - 支持事件回调 Sink 的添加与移除
  - **增强**：所有查询方法现在返回(error)而不是(bool)，提供更详细的错误信息
- ADB 控制器
  - 通过 NewAdbController 创建，参数包含 ADB 可执行路径、设备地址、截图与输入方法、配置、代理二进制路径
  - 截图与输入方法采用位掩码组合，框架会自动选择最快/可用的方法
- Win32 控制器
  - 通过 NewWin32Controller 创建，参数包含窗口句柄、截图方法、鼠标与键盘输入方法
  - 输入方法为单选，直接指定一种策略
- 虚拟游戏pad控制器
  - 通过 NewGamepadController 创建，支持 Xbox 360 和 DualShock 4 游戏pad类型
  - 提供按钮映射和模拟摇杆位置定义，支持触发器压力参数
  - 需要 ViGEm Bus Driver 驱动程序支持
- **新增**：调试控制器
  - **CarouselImageController**：从图片目录循环播放图片作为屏幕内容，用于离线调试
  - **BlankController**：提供最小化的控制器实现，返回预设的空白图像，用于基础功能测试
  - 两者都通过NewCustomController注册，作为DbgController的替代方案
- 自定义控制器
  - 通过 NewCustomController 注册自定义实现，回调由 purego 桥接到 Go 接口
  - 提供 Feature 标志位用于扩展行为（如使用鼠标/键盘按下代替点击）

**章节来源**
- [controller.go](file://controller.go#L1-L512)
- [custom_controller.go](file://custom_controller.go#L1-L436)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)

## 架构总览
控制器的运行时架构如下：
- Go 层 Controller 封装所有公共 API
- 通过 native 层注册的导出函数调用底层原生库（MaaFramework）
- 原生库负责与设备（ADB/模拟器/游戏pad）或 Windows API 交互
- 自定义控制器通过 purego 回调桥接至 Go 实现
- 事件回调通过全局存储映射句柄与回调 ID
- **新增**：调试控制器通过自定义接口实现离线调试功能

```mermaid
sequenceDiagram
participant App as "应用"
participant Ctrl as "Controller(Go)"
participant DebugCtrl as "调试控制器"
participant Native as "native 导出函数"
participant FW as "MaaFramework(原生)"
participant Dev as "设备/模拟器/游戏pad"
App->>Ctrl : "创建控制器(NewAdbController/NewWin32Controller/NewGamepadController)"
App->>DebugCtrl : "创建调试控制器(NewCarouselImageController/NewBlankController)"
Ctrl->>Native : "MaaXxxControllerCreate(...) + MaaGamepadControllerCreate"
DebugCtrl->>Native : "MaaCustomControllerCreate"
Native->>FW : "加载并初始化对应控制器"
FW-->>Ctrl : "返回控制器句柄"
FW-->>DebugCtrl : "返回控制器句柄"
App->>Ctrl : "PostConnect()"
Ctrl->>Native : "MaaControllerPostConnection(handle)"
Native->>FW : "建立设备连接"
FW-->>Ctrl : "返回作业ID"
App->>Ctrl : "Wait()/Status()"
Ctrl->>Native : "MaaControllerWait(handle, id)"
Native->>FW : "查询状态"
FW-->>Ctrl : "完成/失败"
Ctrl-->>App : "结果"
```

**图表来源**
- [controller.go](file://controller.go#L1-L512)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)
- [internal\native\framework.go](file://internal\native\framework.go#L1-L511)

## 组件详解

### 抽象控制器 Controller
- 创建与销毁
  - NewAdbController：传入 ADB 路径、设备地址、截图/输入方法、配置、代理二进制路径
  - NewWin32Controller：传入窗口句柄、截图方法、鼠标/键盘输入方法
  - NewGamepadController：传入窗口句柄、游戏pad类型、截图方法
  - NewCustomController：传入自定义实现接口，内部注册回调并通过指针传递 ID
  - **新增**：NewCarouselImageController、NewBlankController：通过自定义控制器实现调试功能
  - Destroy：释放控制器资源，注销自定义回调与事件 Sink
- **增强**：错误处理模式
  - 所有查询方法现在返回(T, error)而不是(T, bool)，提供更详细的错误信息
  - SetScreenshot现在返回error，支持错误处理
- 选项设置
  - 设置截图目标长边/短边、是否使用原始尺寸等
  - **新增**：SetScreenshot(opts ...ScreenshotOption)提供更灵活的配置方式
- 异步操作
  - PostConnect、PostClick、PostSwipe、PostClickV2、PostSwipeV2、PostClickKey、PostInputText、PostStartApp、PostStopApp、PostTouchDown/Move/Up、PostKeyDown/KeyUp、PostScreencap、PostScroll
  - 每个 PostXxx 返回 Job，支持 Wait/Status 查询
- 运行时信息
  - Connected：检查连接状态
  - CacheImage：获取最近一次截图缓存图像
  - GetUUID：获取控制器唯一标识
  - **增强**：GetShellOutput现在返回(string, error)提供错误处理
- 事件回调
  - AddSink/RemoveSink/ClearSinks：添加/移除/清空事件回调 Sink

**章节来源**
- [controller.go](file://controller.go#L1-L512)
- [internal\store\store.go](file://internal\store\store.go#L1-L65)

### ADB 控制器
- 截图方法（ScreencapMethod）
  - 支持多种策略（编码写入后拉取、直接编码、压缩原始流、网络直连、Minicap 直连/流式、模拟器扩展等）
  - 可按位或组合，默认策略排除某些特定方法
- 输入方法（InputMethod）
  - 支持 ADB Shell、Minicap+ADB 键盘、Maatouch、模拟器扩展等
  - 优先级：EmulatorExtras > Maatouch > MinitouchAndAdbKey > AdbShell
- 字符串解析与回转
  - 提供 ParseXxx 与 String 方法，支持大小写不敏感、空白处理、数值字符串解析
- Shell 命令执行
  - 新增 PostShell 方法，用于在 ADB 控制器上执行 shell 命令，返回 Job 对象
  - **增强**：GetShellOutput 方法，用于获取上一次 shell 命令的输出结果，返回(string, error)

**章节来源**
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller.go](file://controller.go#L373-L390)
- [internal\native\framework.go](file://internal\native\framework.go#L186-L187)

### Win32 控制器
- 截图方法（ScreencapMethod）
  - GDI、FramePool、DXGI 桌面复制、窗口模式复制、PrintWindow、ScreenDC 等
- 输入方法（InputMethod）
  - 抓取窗口、发送消息、投递消息、传统事件、线程消息、带光标位置的消息、阻塞输入等
- 字符串解析与回转
  - 同样提供 ParseXxx 与 String 方法，支持大小写不敏感、空白处理、数值字符串解析

**章节来源**
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)

### 虚拟游戏pad控制器
- 游戏pad类型
  - Xbox360：支持 A、B、X、Y、LB、RB、左/右拇指、Start、Back、Guide、方向键等按钮
  - DualShock4：支持面按钮（Cross、Circle、Square、Triangle）、L1/R1、L3/R3、Options/Share 等按钮
- 按钮映射
  - DS4 面按钮映射到 Xbox 等效按钮，确保兼容性
  - DS4 特殊按钮（PS 按钮、触摸板）使用唯一值
- 触摸交互（V2）
  - TouchLeftStick：左模拟摇杆（x、y 范围：-32768~32767，压力忽略）
  - TouchRightStick：右模拟摇杆（x、y 范围：-32768~32767，压力忽略）
  - TouchLeftTrigger：左触发器/L2（压力范围：0~255，x/y 忽略）
  - TouchRightTrigger：右触发器/R2（压力范围：0~255，x/y 忽略）
- 创建要求
  - 需要安装 ViGEm Bus Driver 驱动程序
  - 支持可选的屏幕截图功能（当提供窗口句柄时）

**章节来源**
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [controller.go](file://controller.go#L105-L128)
- [internal\native\framework.go](file://internal\native\framework.go#L162-L174)

### **新增**：调试控制器

#### CarouselImageController
- **用途**：从图片目录循环播放图片作为屏幕内容，用于离线调试和测试
- **创建**：通过NewCarouselImageController(path string)创建
- **工作原理**：
  - 支持单个图片文件或整个目录
  - 递归遍历目录中的所有图片文件
  - 循环播放图片序列，每次Screencap返回下一张图片
  - 自动检测第一张图片的分辨率作为设备分辨率
- **连接状态**：Connect()返回true，Connected()始终返回true
- **UUID**：返回图片路径作为UUID
- **适用场景**：无设备环境下的UI测试、离线调试、自动化测试

#### BlankController
- **用途**：提供最小化的控制器实现，返回预设的空白图像
- **创建**：通过NewBlankController()创建
- **特点**：
  - 所有操作都返回true，表示成功
  - Screencap返回1280x720的空白RGBA图像
  - Connected始终返回true
  - UUID固定为"blank-controller"
- **适用场景**：基础功能测试、占位符控制器、单元测试

**章节来源**
- [dbg_controller.go](file://dbg_controller.go#L1-L265)

### 自定义控制器
- 接口定义
  - 包含 Connect、RequestUUID、GetFeature、StartApp、StopApp、Screencap、Click、Swipe、TouchDown/Move/Up、ClickKey、InputText、KeyDown/KeyUp 等
- 回调桥接
  - 通过 purego 将 Go 函数注册为 C 回调，原生库调用时携带一个 uint64 的"控制器 ID"，Go 侧据此查找实现
- 特性标志
  - 如使用鼠标/键盘按下代替点击等特性开关

**章节来源**
- [custom_controller.go](file://custom_controller.go#L1-L436)

### 与原生库的交互机制
- 初始化
  - native.Init 加载各模块（Framework/Toolkit/AgentServer/AgentClient），并在 native/framework.go 中注册导出函数
- 控制器创建
  - Controller 调用 native.MaaAdbControllerCreate/MaaWin32ControllerCreate/MaaGamepadControllerCreate/MaaCustomControllerCreate
  - **新增**：DbgController不再在Go绑定中实现，使用CarouselImageController或BlankController替代
- 控制器操作
  - PostXxx 系列最终调用 MaaControllerPostXxx，Wait/Status 调用 MaaControllerWait/MaaControllerStatus
  - V2 版本方法（PostClickV2、PostSwipeV2）支持接触点识别和压力敏感度控制
- 缓存与元数据
  - CacheImage 通过 MaaControllerCachedImage 获取图像缓冲
  - GetUUID 通过 MaaControllerGetUuid 获取字符串缓冲
  - **增强**：GetShellOutput 通过 MaaControllerGetShellOutput 获取shell命令输出
- **新增**：调试控制器绑定
  - 通过MaaCustomControllerCreate绑定自定义调试实现

**章节来源**
- [internal\native\native.go](file://internal\native\native.go#L1-L41)
- [internal\native\framework.go](file://internal\native\framework.go#L1-L511)
- [controller.go](file://controller.go#L1-L512)

### 完整流程示例（Android ADB）
- 设备发现与连接
  - 使用示例中通过 FindAdbDevices 获取设备信息，随后创建 ADB 控制器并 PostConnect
- 屏幕捕获
  - PostScreencap 后 Wait 成功，再通过 CacheImage 获取图像
- 输入模拟
  - PostClick、PostSwipe、PostClickV2、PostSwipeV2、PostInputText、PostClickKey 等
- 应用控制
  - PostStartApp/PostStopApp
- Shell 命令执行
  - 使用 PostShell 执行 shell 命令，通过 Wait 等待执行完成
  - **增强**：使用 GetShellOutput 获取命令输出结果，支持错误处理

**章节来源**
- [examples\quick-start\main.go](file://examples\quick-start\main.go#L1-L41)
- [controller_test.go](file://controller_test.go#L1-L220)

### **新增**：调试控制器使用示例
- CarouselImageController使用
  - 从测试数据集的截图目录创建控制器
  - 连接后进行各种操作测试
  - 适用于无设备环境下的UI测试
- BlankController使用
  - 在Agent客户端示例中作为占位符控制器
  - 适合基础功能验证和集成测试

**章节来源**
- [examples\agent-client\main.go](file://examples\agent-client\main.go#L1-L72)
- [controller_test.go](file://controller_test.go#L1-L220)

## 依赖关系分析
- 组件耦合
  - Controller 对 native 层强依赖，但对平台细节（ADB/Win32/游戏pad）保持抽象
  - 自定义控制器通过回调 ID 与 native 解耦
  - **新增**：调试控制器通过自定义接口实现，保持与主控制器相同的API一致性
- 外部依赖
  - 原生库 MaaFramework，通过 purego 注册导出函数
  - 图像缓冲与字符串缓冲由原生库提供
  - ViGEm Bus Driver（游戏pad控制器）
- 存储与映射
  - CtrlStore 记录每个控制器的事件 Sink 映射与自定义回调 ID，确保销毁时清理

```mermaid
classDiagram
class Controller {
+handle uintptr
+NewAdbController(...)
+NewWin32Controller(...)
+NewGamepadController(...)
+NewCustomController(...)
+NewCarouselImageController(...)
+NewBlankController(...)
+PostConnect() Job
+PostClick(x,y) Job
+PostClickV2(x,y,contact,pressure) Job
+PostSwipe(x1,y1,x2,y2,duration) Job
+PostSwipeV2(x1,y1,x2,y2,duration,contact,pressure) Job
+PostScreencap() Job
+Connected() bool
+CacheImage() (image.Image,error)
+GetUUID() (string,error)
+GetShellOutput() (string,error)
+AddSink(sink) int64
+RemoveSink(id) void
+ClearSinks() void
+Destroy() void
+PostShell(cmd string, timeout time.Duration) Job
+SetScreenshot(opts ...ScreenshotOption) error
}
class ADBMethods {
+ScreencapMethod
+InputMethod
+ParseScreencapMethod()
+ParseInputMethod()
}
class Win32Methods {
+ScreencapMethod
+InputMethod
+ParseScreencapMethod()
+ParseInputMethod()
}
class GamepadButtons {
+ButtonA/ButtonB/ButtonX/ButtonY
+ButtonLB/ButtonRB
+ButtonLeftThumb/ButtonRightThumb
+ButtonStart/ButtonBack/ButtonGuide
+ButtonDpadUp/Down/Left/Right
+ButtonCross/ButtonCircle/ButtonSquare/ButtonTriangle
+ButtonPS/ButtonTouchpad
}
class CustomController {
+Connect() bool
+Connected() bool
+RequestUUID() (string,bool)
+GetFeature() ControllerFeature
+StartApp(intent) bool
+StopApp(intent) bool
+Screencap() (image.Image,bool)
+Click(x,y) bool
+Swipe(x1,y1,x2,y2,duration) bool
+TouchDown(...) bool
+TouchMove(...) bool
+TouchUp(...) bool
+ClickKey(keycode) bool
+InputText(text) bool
+KeyDown(keycode) bool
+KeyUp(keycode) bool
}
class DebugControllers {
+CarouselImageController
+BlankController
+NewCarouselImageController(path) (*Controller,error)
+NewBlankController() (*Controller,error)
}
Controller --> ADBMethods : "使用"
Controller --> Win32Methods : "使用"
Controller --> GamepadButtons : "使用"
Controller --> CustomController : "委托"
Controller --> DebugControllers : "替代DbgController"
```

**图表来源**
- [controller.go](file://controller.go#L1-L512)
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [custom_controller.go](file://custom_controller.go#L1-L436)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)

**章节来源**
- [controller.go](file://controller.go#L1-L512)
- [custom_controller.go](file://custom_controller.go#L1-L436)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)
- [controller\adb\adb.go](file://controller\adb\adb.go#L1-L170)
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [internal\store\store.go](file://internal\store\store.go#L1-L65)

## 性能与延迟考量
- 截图策略选择
  - ADB：默认策略会自动排除较慢或不稳定的方法，优先选择速度与稳定性平衡的方案
  - Win32：根据目标窗口类型选择合适截图方法（如 DXGIDesktopDupWindow 针对前台窗口）
  - 游戏pad：可选的屏幕截图功能，仅在提供窗口句柄时启用
  - **新增**：调试控制器CarouselImageController使用内存中的图片缓存，避免磁盘I/O开销
- 输入方法优先级
  - ADB：优先使用更稳定且兼容性更好的方法（如 Maatouch 或 Minicap），必要时回退到 ADB Shell
  - Win32：根据目标应用类型选择 SendMessage/PostMessage 或带光标位置的消息，减少误触
  - 游戏pad：通过 ViGEm 驱动模拟真实硬件输入，延迟较低
  - **新增**：调试控制器的所有操作都是本地内存操作，无网络或设备通信延迟
- 异步作业模型
  - 所有操作返回 Job，避免阻塞主线程；通过 Wait/Status 轮询或事件 Sink 获取完成通知
  - V2 版本的触摸方法支持更精确的压力控制和多点触控
- 缓存与复用
  - CacheImage 复用最近一次截图，减少重复传输与解码开销
  - **新增**：CarouselImageController缓存图片列表，避免重复解码
- 延迟优化建议
  - 在高并发场景下合并连续操作，减少设备端切换成本
  - 对于频繁点击/滑动，适当增加延时以规避系统节流
  - 合理设置截图目标尺寸，避免过大图像带来的内存与传输压力
  - 游戏pad 控制器需要适当的驱动程序支持，确保低延迟响应
  - **新增**：调试控制器适合高并发测试场景，因为没有外部依赖

## 故障排查指南
- 连接失败
  - 确认 ADB 设备已授权、端口可达；检查 NewAdbController 参数（adbPath、address、config、agentPath）
  - 使用 PostConnect().Wait() 检查连接状态，结合事件 Sink 观察错误日志
  - **新增**：调试控制器连接总是成功，如果遇到问题检查图片路径是否正确
- 截图为空或异常
  - 切换 ScreencapMethod，尝试默认或禁用压缩的 Raw 方案
  - Win32 下针对非前台窗口使用 Window 模式截图
  - 游戏pad 控制器需要验证 ViGEm Bus Driver 是否正确安装
  - **新增**：CarouselImageController检查图片路径是否存在且包含有效的图片文件
  - **新增**：BlankController返回预设图像，如果出现异常检查内存分配
- 输入无效
  - ADB：确认 InputMethod 是否被设备支持；必要时启用 EmulatorExtras
  - Win32：确认窗口句柄有效，必要时使用 SendMessageWithCursorPos
  - 游戏pad：检查按钮映射是否正确，确认游戏pad类型设置
  - **新增**：调试控制器所有输入操作都返回true，如果失败检查调用参数
- 性能抖动
  - 降低截图频率，合并输入操作，合理设置 Wait 轮询间隔
  - 游戏pad 控制器可能需要调整驱动程序设置
  - **新增**：调试控制器性能最佳，适合大规模并发测试
- 自定义控制器未生效
  - 检查 NewCustomController 注册流程与回调 ID 映射；确保 Destroy 时正确注销
- Shell 命令执行失败
  - 确认控制器为 ADB 类型，非 ADB 控制器不支持 Shell 命令
  - 检查命令语法和权限，确保设备已授权 ADB 调试
  - 通过事件 Sink 观察命令执行日志，分析失败原因
  - **增强**：GetShellOutput现在提供详细的错误信息
- 游戏pad 控制器问题
  - 确认 ViGEm Bus Driver 已正确安装
  - 检查游戏pad 类型设置是否与实际硬件匹配
  - 验证按钮映射和模拟摇杆配置
- **新增**：调试控制器问题
  - CarouselImageController：检查图片路径权限、文件格式支持、磁盘空间
  - BlankController：通常不会出现问题，主要用于占位和测试

**章节来源**
- [controller_test.go](file://controller_test.go#L1-L220)
- [controller.go](file://controller.go#L1-L512)
- [dbg_controller.go](file://dbg_controller.go#L1-L265)

## 结论
控制器通过统一抽象屏蔽了平台差异，使上层逻辑无需关心底层设备细节。借助 native 层导出函数与原生库协作，实现了稳定的设备连接、高效的屏幕捕获与可靠的输入模拟。配合异步作业模型与事件回调机制，能够满足复杂自动化场景的需求。

**更新** 新增了虚拟游戏pad控制器支持，包括 Xbox 360 和 DualShock 4 控制器的完整按钮映射和模拟摇杆支持。同时引入了 V2 版本的触摸交互方法，支持接触点识别和压力敏感度控制，为更精确的输入模拟提供了可能。

**重大更新**：DbgController功能已被移除，取而代之的是功能更强大、使用更灵活的调试控制器。CarouselImageController和BlankController作为替代品，提供了更好的离线调试体验和更清晰的错误处理机制。

在实际部署中，应根据设备类型与环境特征选择合适的截图与输入策略，并结合缓存与延迟优化提升整体性能与稳定性。新增的 Shell 命令执行功能进一步增强了 ADB 控制器的设备交互能力，而游戏pad 控制器则为需要精确模拟硬件输入的场景提供了专业解决方案。ViGEm 驱动程序的正确安装是游戏pad 功能正常工作的关键前提。

**新增**：调试控制器特别适合以下场景：
- 无设备环境下的UI测试和自动化验证
- 高并发测试场景，避免设备依赖
- 离线调试和开发环境搭建
- 单元测试和集成测试的基础设施

## 附录：平台示例与配置建议

### Android ADB 示例（快速开始）
- 步骤概览
  - 初始化框架与配置
  - 发现设备并创建 ADB 控制器
  - 连接设备、加载资源、绑定控制器与资源
  - 执行任务并输出结果
- 关键点
  - NewAdbController 的参数需与设备匹配（adbPath、address、screencapMethod、inputMethod、config、agentPath）
  - PostConnect 后再进行后续操作
  - 使用 CacheImage 获取截图结果
  - 使用 PostShell 执行 shell 命令，GetShellOutput 获取输出

**章节来源**
- [examples\quick-start\main.go](file://examples\quick-start\main.go#L1-L41)
- [controller_test.go](file://controller_test.go#L1-L220)

### Windows Win32 示例（思路）
- 步骤概览
  - 获取目标窗口句柄
  - 创建 Win32 控制器（选择合适的截图与输入方法）
  - 进行点击、滑动、输入文本等操作
- 关键点
  - 截图方法建议优先考虑 DXGIDesktopDupWindow（前台窗口）
  - 输入方法可选择 SendMessage/PostMessage 或带光标位置的消息

**章节来源**
- [controller\win32\win32.go](file://controller\win32\win32.go#L1-L164)
- [controller_test.go](file://controller_test.go#L1-L220)

### 虚拟游戏pad 控制器示例（新增）
- 步骤概览
  - 获取目标窗口句柄（可选，用于屏幕截图）
  - 创建游戏pad 控制器（选择 Xbox360 或 DualShock4 类型）
  - 配置按钮映射和模拟摇杆参数
  - 进行按钮点击、摇杆移动、触发器按压等操作
- 关键点
  - 需要安装 ViGEm Bus Driver 驱动程序
  - Xbox360 类型支持标准游戏pad 按钮布局
  - DualShock4 类型支持额外的 PS 按钮和触摸板功能
  - 使用 V2 触摸方法支持精确的压力控制

**章节来源**
- [controller\gamepad\gamepad.go](file://controller\gamepad\gamepad.go#L1-L64)
- [controller.go](file://controller.go#L105-L128)

### **新增**：调试控制器使用示例

#### CarouselImageController示例
- 适用场景：离线UI测试、无设备环境调试
- 创建方式：NewCarouselImageController("./test/data_set/PipelineSmoking/Screenshot")
- 使用流程：
  - 创建控制器
  - PostConnect().Wait() - 总是成功
  - PostScreencap().Wait() - 获取下一张图片
  - CacheImage() - 获取当前图片
  - 支持所有标准控制器操作

#### BlankController示例
- 适用场景：占位符控制器、基础功能测试
- 创建方式：NewBlankController()
- 使用流程：
  - 创建控制器
  - PostConnect().Wait() - 总是成功
  - PostScreencap().Wait() - 返回1280x720空白图像
  - 适合快速验证系统其他组件

**章节来源**
- [examples\agent-client\main.go](file://examples\agent-client\main.go#L1-L72)
- [controller_test.go](file://controller_test.go#L1-L220)

### 配置建议（按场景）
- 高帧率/低延迟
  - 截图：ADB 优先默认策略；Win32 优先 DXGI 桌面复制；游戏pad 控制器可选屏幕截图
  - 输入：ADB 优先 Maatouch/Minicap；Win32 优先 SendMessage；游戏pad 通过 ViGEm 驱动
  - **新增**：调试控制器适合高并发场景，性能最佳
- 兼容性优先
  - ADB：启用默认策略，避免强制 Raw/Netcat
  - Win32：使用 SendMessage/PostMessage，避免阻塞输入
  - 游戏pad：确保 ViGEm 驱动程序版本兼容
  - **新增**：调试控制器兼容性最好，无外部依赖
- 资源受限
  - 降低截图目标尺寸，启用 CacheImage 复用
  - 合并连续操作，减少设备切换次数
  - 游戏pad 控制器可能需要额外的系统资源
  - **新增**：调试控制器内存占用最小，适合资源受限环境
- **新增**：离线开发环境
  - 使用CarouselImageController进行UI界面测试
  - 使用BlankController进行基础功能验证
  - 避免设备依赖，提高开发效率