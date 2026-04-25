# API参考

<cite>
**本文档中引用的文件**  
- [maa.go](file://maa.go)
- [tasker.go](file://tasker.go)
- [controller.go](file://controller.go)
- [resource.go](file://resource.go)
- [job.go](file://job.go)
- [status.go](file://status.go)
- [custom_action.go](file://custom_action.go)
- [custom_recognition.go](file://custom_recognition.go)
- [custom_controller.go](file://custom_controller.go)
- [event.go](file://event.go)
- [context.go](file://context.go)
- [rect.go](file://rect.go)
</cite>

## 目录
1. [初始化与配置](#初始化与配置)
2. [任务管理](#任务管理)
3. [控制器操作](#控制器操作)
4. [资源管理](#资源管理)
5. [自定义功能](#自定义功能)
6. [事件回调](#事件回调)
7. [上下文操作](#上下文操作)
8. [状态与作业](#状态与作业)

## 初始化与配置

`maa.Init()` 函数用于加载MAA框架的动态库并注册相关函数。在调用任何其他MAA相关函数之前必须先调用此函数。该函数采用可变数量的 `InitOption` 类型参数，用于配置初始化选项。

### InitConfig
`InitConfig` 结构体包含初始化MAA框架的配置选项，具体字段如下：

- **LibDir**：指定MAA动态库所在的目录路径。如果为空，框架将尝试在默认路径中定位库。
- **LogDir**：指定日志文件的写入目录。如果未指定，默认为 "./debug"。
- **SaveDraw**：控制是否将识别结果保存到 LogDir/vision 目录。启用后，RecoDetail 将能够检索绘制内容用于调试。
- **StdoutLevel**：设置标准输出的日志详细程度级别，控制哪些日志消息显示在控制台上。
- **DebugMode**：启用或禁用全面的调试模式。启用后，将收集和记录额外的调试信息。
- **PluginPaths**：指定要加载的插件路径。如果为空，框架将不加载任何插件。

### InitOption
`InitOption` 是一个函数类型，用于通过函数式选项模式配置 `InitConfig`。每个 `InitOption` 函数修改 `InitConfig` 以设置特定的初始化参数。

### WithLibDir
返回一个 `InitOption`，用于设置MAA框架的库目录路径。`libDir` 参数指定包含MAA动态库的目录。

**函数签名**
```go
func WithLibDir(libDir string) InitOption
```

**参数**
- `libDir` (string)：库目录路径。

**返回值**
- `InitOption`：初始化选项函数。

**使用示例**
```go
maa.Init(WithLibDir("./libs"))
```

### WithLogDir
返回一个 `InitOption`，用于设置日志文件的目录路径。`logDir` 参数指定MAA框架应将日志文件写入的位置。

**函数签名**
```go
func WithLogDir(logDir string) InitOption
```

**参数**
- `logDir` (string)：日志目录路径。

**返回值**
- `InitOption`：初始化选项函数。

**使用示例**
```go
maa.Init(WithLogDir("./logs"))
```

### WithSaveDraw
返回一个 `InitOption`，用于配置是否保存绘制信息。当 `enabled` 为 `true` 时，识别结果将被保存到 LogDir/vision 目录，且 RecoDetail 将能够检索绘制内容用于调试。

**函数签名**
```go
func WithSaveDraw(enabled bool) InitOption
```

**参数**
- `enabled` (bool)：是否启用保存绘制功能。

**返回值**
- `InitOption`：初始化选项函数。

**使用示例**
```go
maa.Init(WithSaveDraw(true))
```

### WithStdoutLevel
返回一个 `InitOption`，用于设置标准输出的日志级别。`level` 参数确定写入标准输出的日志消息的详细程度。

**函数签名**
```go
func WithStdoutLevel(level LoggingLevel) InitOption
```

**参数**
- `level` (LoggingLevel)：日志级别。

**返回值**
- `InitOption`：初始化选项函数。

**可能的错误类型**
- 无

**使用示例**
```go
maa.Init(WithStdoutLevel(LoggingLevelDebug))
```

### WithDebugMode
返回一个 `InitOption`，用于启用或禁用调试模式。当 `enabled` 为 `true` 时，将收集和记录额外的调试信息。

**函数签名**
```go
func WithDebugMode(enabled bool) InitOption
```

**参数**
- `enabled` (bool)：是否启用调试模式。

**返回值**
- `InitOption`：初始化选项函数。

**使用示例**
```go
maa.Init(WithDebugMode(true))
```

### WithPluginPaths
返回一个 `InitOption`，用于设置要加载的插件路径。

**函数签名**
```go
func WithPluginPaths(path ...string) InitOption
```

**参数**
- `path` (...string)：插件路径列表。

**返回值**
- `InitOption`：初始化选项函数。

**使用示例**
```go
maa.Init(WithPluginPaths("./plugin1", "./plugin2"))
```

### Init
加载与MAA框架相关的动态库并注册其相关函数。必须在调用任何其他MAA相关函数之前调用此函数。如果未在其他MAA函数之前调用此函数，将触发空指针恐慌。

**函数签名**
```go
func Init(opts ...InitOption) error
```

**参数**
- `opts` (...InitOption)：初始化选项。

**返回值**
- `error`：如果框架已初始化，则返回 `ErrAlreadyInitialized` 错误。

**可能的错误类型**
- `ErrAlreadyInitialized`：框架已初始化。
- `ErrNotInitialized`：框架未初始化。

**使用示例**
```go
err := maa.Init(WithLogDir("./logs"), WithDebugMode(true))
if err != nil {
    log.Fatal(err)
}
```

### IsInited
检查MAA框架是否已初始化。

**函数签名**
```go
func IsInited() bool
```

**返回值**
- `bool`：如果已初始化则返回 `true`，否则返回 `false`。

**使用示例**
```go
if maa.IsInited() {
    fmt.Println("MAA框架已初始化")
}
```

### Release
释放MAA框架的动态库资源并注销其相关函数。必须在通过 `Init` 初始化框架后才能调用此函数。

**函数签名**
```go
func Release() error
```

**返回值**
- `error`：如果框架未初始化，则返回 `ErrNotInitialized` 错误。

**可能的错误类型**
- `ErrNotInitialized`：框架未初始化。

**使用示例**
```go
err := maa.Release()
if err != nil {
    log.Fatal(err)
}
```

### SetLogDir
设置日志目录。

**函数签名**
```go
func SetLogDir(path string) bool
```

**参数**
- `path` (string)：日志目录路径。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := maa.SetLogDir("./new_logs")
```

### SetSaveDraw
设置是否保存绘制。

**函数签名**
```go
func SetSaveDraw(enabled bool) bool
```

**参数**
- `enabled` (bool)：是否启用保存绘制。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := maa.SetSaveDraw(true)
```

### SetStdoutLevel
设置标准输出日志级别。

**函数签名**
```go
func SetStdoutLevel(level LoggingLevel) bool
```

**参数**
- `level` (LoggingLevel)：日志级别。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := maa.SetStdoutLevel(LoggingLevelInfo)
```

### SetDebugMode
设置是否启用调试模式。

**函数签名**
```go
func SetDebugMode(enabled bool) bool
```

**参数**
- `enabled` (bool)：是否启用调试模式。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := maa.SetDebugMode(true)
```

### LoadPlugin
加载由 `path` 指定的插件。`path` 可以是完整的文件系统路径或仅插件名称。当仅提供名称时，函数会在系统目录和当前工作目录中搜索匹配的插件。如果 `path` 指向目录，则会递归搜索该目录内的插件。

**函数签名**
```go
func LoadPlugin(path string) bool
```

**参数**
- `path` (string)：插件路径。

**返回值**
- `bool`：加载成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := maa.LoadPlugin("./my_plugin")
```

**Section sources**
- [maa.go](file://maa.go#L108-L210)

## 任务管理

`NewTasker()` 函数创建一个新的任务管理器实例，用于管理任务的执行。`PostTask()` 和 `PostBundle()` 方法用于提交任务和资源包。

### NewTasker
创建一个新的任务管理器。

**函数签名**
```go
func NewTasker() *Tasker
```

**返回值**
- `*Tasker`：新创建的任务管理器实例，如果创建失败则返回 `nil`。

**使用示例**
```go
tasker := maa.NewTasker()
defer tasker.Destroy()
```

### Destroy
释放任务管理器实例。

**函数签名**
```go
func (t *Tasker) Destroy()
```

**使用示例**
```go
tasker.Destroy()
```

### BindResource
将任务管理器绑定到已初始化的资源。

**函数签名**
```go
func (t *Tasker) BindResource(res *Resource) bool
```

**参数**
- `res` (*Resource)：资源实例。

**返回值**
- `bool`：绑定成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := tasker.BindResource(res)
```

### BindController
将任务管理器绑定到已初始化的控制器。

**函数签名**
```go
func (t *Tasker) BindController(ctrl *Controller) bool
```

**参数**
- `ctrl` (*Controller)：控制器实例。

**返回值**
- `bool`：绑定成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := tasker.BindController(ctrl)
```

### Initialized
检查任务管理器是否已初始化。

**函数签名**
```go
func (t *Tasker) Initialized() bool
```

**返回值**
- `bool`：如果已初始化则返回 `true`，否则返回 `false`。

**使用示例**
```go
if tasker.Initialized() {
    fmt.Println("任务管理器已初始化")
}
```

### PostTask
向任务管理器提交一个任务。`override` 是一个可选参数。如果提供，它应该是一个可以是JSON字符串或任何可以编组为JSON的数据类型的单一值。如果提供多个值，则只使用第一个值。

**函数签名**
```go
func (t *Tasker) PostTask(entry string, override ...any) *TaskJob
```

**参数**
- `entry` (string)：任务入口名称。
- `override` (...any)：任务配置覆盖。

**返回值**
- `*TaskJob`：表示提交任务的作业实例。

**使用示例**
```go
job := tasker.PostTask("Startup", map[string]interface{}{
    "Task": map[string]interface{}{
        "action": "Click",
        "target": []int{100, 200, 100, 100},
    },
})
detail := job.Wait().GetDetail()
```

### Stopping
检查任务管理器是否正在停止。

**函数签名**
```go
func (t *Tasker) Stopping() bool
```

**返回值**
- `bool`：如果正在停止则返回 `true`，否则返回 `false`。

**使用示例**
```go
if tasker.Stopping() {
    fmt.Println("任务管理器正在停止")
}
```

### Running
检查实例是否正在运行。

**函数签名**
```go
func (t *Tasker) Running() bool
```

**返回值**
- `bool`：如果正在运行则返回 `true`，否则返回 `false`。

**使用示例**
```go
if tasker.Running() {
    fmt.Println("任务管理器正在运行")
}
```

### PostStop
向任务管理器提交停止信号。

**函数签名**
```go
func (t *Tasker) PostStop() *TaskJob
```

**返回值**
- `*TaskJob`：表示停止操作的作业实例。

**使用示例**
```go
job := tasker.PostStop()
job.Wait()
```

### GetResource
获取任务管理器的资源句柄。

**函数签名**
```go
func (t *Tasker) GetResource() *Resource
```

**返回值**
- `*Resource`：资源实例。

**使用示例**
```go
res := tasker.GetResource()
```

### GetController
获取任务管理器的控制器句柄。

**函数签名**
```go
func (t *Tasker) GetController() *Controller
```

**返回值**
- `*Controller`：控制器实例。

**使用示例**
```go
ctrl := tasker.GetController()
```

### ClearCache
清除运行时缓存。

**函数签名**
```go
func (t *Tasker) ClearCache() bool
```

**返回值**
- `bool`：清除成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := tasker.ClearCache()
```

### GetLatestNode
获取最新节点的详细信息。

**函数签名**
```go
func (t *Tasker) GetLatestNode(taskName string) *NodeDetail
```

**参数**
- `taskName` (string)：任务名称。

**返回值**
- `*NodeDetail`：节点详细信息，如果未找到则返回 `nil`。

**使用示例**
```go
nodeDetail := tasker.GetLatestNode("Task1")
```

**Section sources**
- [tasker.go](file://tasker.go#L17-L355)

## 控制器操作

`NewAdbController()` 和 `NewWin32Controller()` 函数用于创建不同类型的控制器实例。控制器提供了与设备交互的方法，如点击、滑动和截图。

### NewAdbController
创建一个新的ADB控制器。

**函数签名**
```go
func NewAdbController(
    adbPath, address string,
    screencapMethod adb.ScreencapMethod,
    inputMethod adb.InputMethod,
    config, agentPath string,
) *Controller
```

**参数**
- `adbPath` (string)：ADB可执行文件路径。
- `address` (string)：设备地址。
- `screencapMethod` (adb.ScreencapMethod)：截图方法。
- `inputMethod` (adb.InputMethod)：输入方法。
- `config` (string)：配置字符串。
- `agentPath` (string)：代理二进制文件路径。

**返回值**
- `*Controller`：新创建的控制器实例，如果创建失败则返回 `nil`。

**使用示例**
```go
ctrl := maa.NewAdbController(
    device.AdbPath,
    device.Address,
    device.ScreencapMethod,
    device.InputMethod,
    device.Config,
    "path/to/MaaAgentBinary",
)
defer ctrl.Destroy()
```

### NewWin32Controller
创建一个Win32控制器实例。

**函数签名**
```go
func NewWin32Controller(
    hWnd unsafe.Pointer,
    screencapMethod win32.ScreencapMethod,
    mouseMethod win32.InputMethod,
    keyboardMethod win32.InputMethod,
) *Controller
```

**参数**
- `hWnd` (unsafe.Pointer)：窗口句柄。
- `screencapMethod` (win32.ScreencapMethod)：截图方法。
- `mouseMethod` (win32.InputMethod)：鼠标输入方法。
- `keyboardMethod` (win32.InputMethod)：键盘输入方法。

**返回值**
- `*Controller`：新创建的控制器实例，如果创建失败则返回 `nil`。

**使用示例**
```go
ctrl := maa.NewWin32Controller(
    windowHandle,
    win32.ScreencapMethod_GDI,
    win32.InputMethod_SendMessage,
    win32.InputMethod_SendMessage,
)
defer ctrl.Destroy()
```

### NewCustomController
创建一个自定义控制器实例。

**函数签名**
```go
func NewCustomController(ctrl CustomController) *Controller
```

**参数**
- `ctrl` (CustomController)：自定义控制器实现。

**返回值**
- `*Controller`：新创建的控制器实例，如果创建失败则返回 `nil`。

**使用示例**
```go
ctrl := maa.NewCustomController(&MyCustomController{})
defer ctrl.Destroy()
```

### Destroy
释放控制器实例。

**函数签名**
```go
func (c *Controller) Destroy()
```

**使用示例**
```go
ctrl.Destroy()
```

### SetScreenshotTargetLongSide
设置截图目标长边。只能设置长边或短边之一，另一个将根据宽高比自动缩放。

**函数签名**
```go
func (c *Controller) SetScreenshotTargetLongSide(targetLongSide int32) bool
```

**参数**
- `targetLongSide` (int32)：目标长边尺寸。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctrl.SetScreenshotTargetLongSide(1280)
```

### SetScreenshotTargetShortSide
设置截图目标短边。只能设置长边或短边之一，另一个将根据宽高比自动缩放。

**函数签名**
```go
func (c *Controller) SetScreenshotTargetShortSide(targetShortSide int32) bool
```

**参数**
- `targetShortSide` (int32)：目标短边尺寸。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctrl.SetScreenshotTargetShortSide(720)
```

### SetScreenshotUseRawSize
设置截图是否使用原始尺寸而不进行缩放。

**函数签名**
```go
func (c *Controller) SetScreenshotUseRawSize(enabled bool) bool
```

**参数**
- `enabled` (bool)：是否启用原始尺寸。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctrl.SetScreenshotUseRawSize(false)
```

### PostConnect
提交连接请求。

**函数签名**
```go
func (c *Controller) PostConnect() *Job
```

**返回值**
- `*Job`：表示连接操作的作业实例。

**使用示例**
```go
job := ctrl.PostConnect()
job.Wait()
```

### PostClick
提交点击操作。

**函数签名**
```go
func (c *Controller) PostClick(x, y int32) *Job
```

**参数**
- `x` (int32)：点击的X坐标。
- `y` (int32)：点击的Y坐标。

**返回值**
- `*Job`：表示点击操作的作业实例。

**使用示例**
```go
job := ctrl.PostClick(100, 200)
job.Wait()
```

### PostSwipe
提交滑动操作。

**函数签名**
```go
func (c *Controller) PostSwipe(x1, y1, x2, y2 int32, duration time.Duration) *Job
```

**参数**
- `x1` (int32)：起始点X坐标。
- `y1` (int32)：起始点Y坐标。
- `x2` (int32)：结束点X坐标。
- `y2` (int32)：结束点Y坐标。
- `duration` (time.Duration)：滑动持续时间。

**返回值**
- `*Job`：表示滑动操作的作业实例。

**使用示例**
```go
job := ctrl.PostSwipe(100, 200, 300, 400, time.Second)
job.Wait()
```

### PostClickKey
提交按键点击操作。

**函数签名**
```go
func (c *Controller) PostClickKey(keycode int32) *Job
```

**参数**
- `keycode` (int32)：按键代码。

**返回值**
- `*Job`：表示按键点击操作的作业实例。

**使用示例**
```go
job := ctrl.PostClickKey(66) // KEYCODE_BACK
job.Wait()
```

### PostInputText
提交文本输入操作。

**函数签名**
```go
func (c *Controller) PostInputText(text string) *Job
```

**参数**
- `text` (string)：要输入的文本。

**返回值**
- `*Job`：表示文本输入操作的作业实例。

**使用示例**
```go
job := ctrl.PostInputText("Hello, World!")
job.Wait()
```

### PostStartApp
提交启动应用操作。

**函数签名**
```go
func (c *Controller) PostStartApp(intent string) *Job
```

**参数**
- `intent` (string)：启动意图。

**返回值**
- `*Job`：表示启动应用操作的作业实例。

**使用示例**
```go
job := ctrl.PostStartApp("com.example.app/.MainActivity")
job.Wait()
```

### PostStopApp
提交停止应用操作。

**函数签名**
```go
func (c *Controller) PostStopApp(intent string) *Job
```

**参数**
- `intent` (string)：停止意图。

**返回值**
- `*Job`：表示停止应用操作的作业实例。

**使用示例**
```go
job := ctrl.PostStopApp("com.example.app")
job.Wait()
```

### PostTouchDown
提交触摸按下操作。

**函数签名**
```go
func (c *Controller) PostTouchDown(contact, x, y, pressure int32) *Job
```

**参数**
- `contact` (int32)：触点ID。
- `x` (int32)：X坐标。
- `y` (int32)：Y坐标。
- `pressure` (int32)：压力值。

**返回值**
- `*Job`：表示触摸按下操作的作业实例。

**使用示例**
```go
job := ctrl.PostTouchDown(0, 100, 200, 1)
job.Wait()
```

### PostTouchMove
提交触摸移动操作。

**函数签名**
```go
func (c *Controller) PostTouchMove(contact, x, y, pressure int32) *Job
```

**参数**
- `contact` (int32)：触点ID。
- `x` (int32)：X坐标。
- `y` (int32)：Y坐标。
- `pressure` (int32)：压力值。

**返回值**
- `*Job`：表示触摸移动操作的作业实例。

**使用示例**
```go
job := ctrl.PostTouchMove(0, 150, 250, 1)
job.Wait()
```

### PostTouchUp
提交触摸释放操作。

**函数签名**
```go
func (c *Controller) PostTouchUp(contact int32) *Job
```

**参数**
- `contact` (int32)：触点ID。

**返回值**
- `*Job`：表示触摸释放操作的作业实例。

**使用示例**
```go
job := ctrl.PostTouchUp(0)
job.Wait()
```

### PostKeyDown
提交按键按下操作。

**函数签名**
```go
func (c *Controller) PostKeyDown(keycode int32) *Job
```

**参数**
- `keycode` (int32)：按键代码。

**返回值**
- `*Job`：表示按键按下操作的作业实例。

**使用示例**
```go
job := ctrl.PostKeyDown(66) // KEYCODE_BACK
job.Wait()
```

### PostKeyUp
提交按键释放操作。

**函数签名**
```go
func (c *Controller) PostKeyUp(keycode int32) *Job
```

**参数**
- `keycode` (int32)：按键代码。

**返回值**
- `*Job`：表示按键释放操作的作业实例。

**使用示例**
```go
job := ctrl.PostKeyUp(66) // KEYCODE_BACK
job.Wait()
```

### PostScreencap
提交截图操作。

**函数签名**
```go
func (c *Controller) PostScreencap() *Job
```

**返回值**
- `*Job`：表示截图操作的作业实例。

**使用示例**
```go
job := ctrl.PostScreencap()
job.Wait()
img := ctrl.CacheImage()
```

### PostScroll
提交滚动操作。

**函数签名**
```go
func (c *Controller) PostScroll(dx, dy int32) *Job
```

**参数**
- `dx` (int32)：水平滚动距离。
- `dy` (int32)：垂直滚动距离。

**返回值**
- `*Job`：表示滚动操作的作业实例。

**使用示例**
```go
job := ctrl.PostScroll(0, -100)
job.Wait()
```

### Connected
检查控制器是否已连接。

**函数签名**
```go
func (c *Controller) Connected() bool
```

**返回值**
- `bool`：如果已连接则返回 `true`，否则返回 `false`。

**使用示例**
```go
if ctrl.Connected() {
    fmt.Println("控制器已连接")
}
```

### CacheImage
获取最后一次截图请求的图像缓冲区。

**函数签名**
```go
func (c *Controller) CacheImage() image.Image
```

**返回值**
- `image.Image`：截图图像，如果获取失败则返回 `nil`。

**使用示例**
```go
img := ctrl.CacheImage()
if img != nil {
    // 处理图像
}
```

### GetUUID
获取控制器的UUID。

**函数签名**
```go
func (c *Controller) GetUUID() (string, bool)
```

**返回值**
- `string`：UUID字符串。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
uuid, ok := ctrl.GetUUID()
if ok {
    fmt.Printf("UUID: %s\n", uuid)
}
```

**Section sources**
- [controller.go](file://controller.go#L28-L277)

## 资源管理

`NewResource()` 函数创建一个新的资源管理器实例，用于管理资源的加载和配置。`PostBundle()` 方法用于提交资源包。

### NewResource
创建一个新的资源管理器。

**函数签名**
```go
func NewResource() *Resource
```

**返回值**
- `*Resource`：新创建的资源管理器实例，如果创建失败则返回 `nil`。

**使用示例**
```go
res := maa.NewResource()
defer res.Destroy()
```

### Destroy
释放资源管理器实例。

**函数签名**
```go
func (r *Resource) Destroy()
```

**使用示例**
```go
res.Destroy()
```

### UseCPU
设置使用CPU进行推理。

**函数签名**
```go
func (r *Resource) UseCPU() bool
```

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UseCPU()
```

### UseDirectml
设置使用DirectML进行推理。

**函数签名**
```go
func (r *Resource) UseDirectml(deviceID InterenceDevice) bool
```

**参数**
- `deviceID` (InterenceDevice)：设备ID。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UseDirectml(InferenceDevice0)
```

### UseCoreml
设置使用CoreML进行推理。

**函数签名**
```go
func (r *Resource) UseCoreml(coremlFlag InterenceDevice) bool
```

**参数**
- `coremlFlag` (InterenceDevice)：CoreML标志。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UseCoreml(InterenceDeviceAuto)
```

### UseAutoExecutionProvider
设置使用自动执行提供程序进行推理。

**函数签名**
```go
func (r *Resource) UseAutoExecutionProvider() bool
```

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UseAutoExecutionProvider()
```

### RegisterCustomRecognition
向资源注册自定义识别。

**函数签名**
```go
func (r *Resource) RegisterCustomRecognition(name string, recognition CustomRecognition) bool
```

**参数**
- `name` (string)：识别名称。
- `recognition` (CustomRecognition)：自定义识别实现。

**返回值**
- `bool`：注册成功返回 `true`，否则返回 `false`。

**使用示例**
```go
res.RegisterCustomRecognition("MyRec", &MyRec{})
```

### UnregisterCustomRecognition
从资源中注销自定义识别。

**函数签名**
```go
func (r *Resource) UnregisterCustomRecognition(name string) bool
```

**参数**
- `name` (string)：识别名称。

**返回值**
- `bool`：注销成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UnregisterCustomRecognition("MyRec")
```

### ClearCustomRecognition
清除资源中注册的所有自定义识别。

**函数签名**
```go
func (r *Resource) ClearCustomRecognition() bool
```

**返回值**
- `bool`：清除成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.ClearCustomRecognition()
```

### RegisterCustomAction
向资源注册自定义操作。

**函数签名**
```go
func (r *Resource) RegisterCustomAction(name string, action CustomAction) bool
```

**参数**
- `name` (string)：操作名称。
- `action` (CustomAction)：自定义操作实现。

**返回值**
- `bool`：注册成功返回 `true`，否则返回 `false`。

**使用示例**
```go
res.RegisterCustomAction("MyAct", &MyAct{})
```

### UnregisterCustomAction
从资源中注销自定义操作。

**函数签名**
```go
func (r *Resource) UnregisterCustomAction(name string) bool
```

**参数**
- `name` (string)：操作名称。

**返回值**
- `bool`：注销成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.UnregisterCustomAction("MyAct")
```

### ClearCustomAction
清除资源中注册的所有自定义操作。

**函数签名**
```go
func (r *Resource) ClearCustomAction() bool
```

**返回值**
- `bool`：清除成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.ClearCustomAction()
```

### PostBundle
向资源加载路径添加路径。返回资源的ID。

**函数签名**
```go
func (r *Resource) PostBundle(path string) *Job
```

**参数**
- `path` (string)：资源路径。

**返回值**
- `*Job`：表示资源加载操作的作业实例。

**使用示例**
```go
job := res.PostBundle("./resource")
job.Wait()
```

### OverridePipeline
覆盖管道配置。`override` 参数可以是JSON字符串或任何可以编组为JSON的数据类型。

**函数签名**
```go
func (r *Resource) OverridePipeline(override any) bool
```

**参数**
- `override` (any)：管道覆盖配置。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.OverridePipeline(map[string]interface{}{
    "Task": map[string]interface{}{
        "recognition": "TemplateMatch",
        "template": "template.png",
    },
})
```

### OverrideNext
覆盖任务的下一个列表。

**函数签名**
```go
func (r *Resource) OverrideNext(name string, nextList []string) bool
```

**参数**
- `name` (string)：任务名称。
- `nextList` ([]string)：下一个任务列表。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.OverrideNext("Task1", []string{"TaskA", "TaskB"})
```

### OverriderImage
覆盖图像。

**函数签名**
```go
func (r *Resource) OverriderImage(imageName string, image image.Image) bool
```

**参数**
- `imageName` (string)：图像名称。
- `image` (image.Image)：图像实例。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.OverriderImage("template", img)
```

### GetNodeJSON
根据名称获取节点JSON。

**函数签名**
```go
func (r *Resource) GetNodeJSON(name string) (string, bool)
```

**参数**
- `name` (string)：节点名称。

**返回值**
- `string`：节点JSON字符串。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
jsonStr, ok := res.GetNodeJSON("Task1")
if ok {
    fmt.Println(jsonStr)
}
```

### Clear
清除资源加载路径。

**函数签名**
```go
func (r *Resource) Clear() bool
```

**返回值**
- `bool`：清除成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := res.Clear()
```

### Loaded
检查资源是否已加载。

**函数签名**
```go
func (r *Resource) Loaded() bool
```

**返回值**
- `bool`：如果已加载则返回 `true`，否则返回 `false`。

**使用示例**
```go
if res.Loaded() {
    fmt.Println("资源已加载")
}
```

### GetHash
返回资源的哈希值。

**函数签名**
```go
func (r *Resource) GetHash() (string, bool)
```

**返回值**
- `string`：资源哈希值。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
hash, ok := res.GetHash()
if ok {
    fmt.Printf("Hash: %s\n", hash)
}
```

### GetNodeList
返回资源的节点列表。

**函数签名**
```go
func (r *Resource) GetNodeList() ([]string, bool)
```

**返回值**
- `[]string`：节点名称列表。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
nodes, ok := res.GetNodeList()
if ok {
    for _, node := range nodes {
        fmt.Println(node)
    }
}
```

### GetCustomRecognitionList
返回资源的自定义识别列表。

**函数签名**
```go
func (r *Resource) GetCustomRecognitionList() ([]string, bool)
```

**返回值**
- `[]string`：自定义识别名称列表。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
recs, ok := res.GetCustomRecognitionList()
if ok {
    for _, rec := range recs {
        fmt.Println(rec)
    }
}
```

### GetCustomActionList
返回资源的自定义操作列表。

**函数签名**
```go
func (r *Resource) GetCustomActionList() ([]string, bool)
```

**返回值**
- `[]string`：自定义操作名称列表。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
acts, ok := res.GetCustomActionList()
if ok {
    for _, act := range acts {
        fmt.Println(act)
    }
}
```

**Section sources**
- [resource.go](file://resource.go#L17-L382)

## 自定义功能

`CustomRecognition` 和 `CustomAction` 接口允许用户实现自定义的识别和操作逻辑。`RegisterCustomRecognition()` 和 `RegisterCustomAction()` 方法用于注册这些自定义功能。

### CustomRecognition
自定义识别接口，实现者必须提供 `Run` 方法。

**接口定义**
```go
type CustomRecognition interface {
    Run(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool)
}
```

### CustomRecognitionArg
自定义识别参数结构体。

**字段**
- `TaskDetail` (*TaskDetail)：任务详细信息。
- `CurrentTaskName` (string)：当前任务名称。
- `CustomRecognitionName` (string)：自定义识别名称。
- `CustomRecognitionParam` (string)：自定义识别参数。
- `Img` (image.Image)：输入图像。
- `Roi` (Rect)：感兴趣区域。

### CustomRecognitionResult
自定义识别结果结构体。

**字段**
- `Box` (Rect)：识别到的区域。
- `Detail` (string)：详细信息。

### CustomAction
自定义操作接口，实现者必须提供 `Run` 方法。

**接口定义**
```go
type CustomAction interface {
    Run(ctx *Context, arg *CustomActionArg) bool
}
```

### CustomActionArg
自定义操作参数结构体。

**字段**
- `TaskDetail` (*TaskDetail)：任务详细信息。
- `CurrentTaskName` (string)：当前任务名称。
- `CustomActionName` (string)：自定义操作名称。
- `CustomActionParam` (string)：自定义操作参数。
- `RecognitionDetail` (*RecognitionDetail)：识别详细信息。
- `Box` (Rect)：区域。

### CustomController
自定义控制器接口，实现者必须提供 `Connect`, `RequestUUID`, `GetFeature`, `StartApp`, `StopApp`, `Screencap`, `Click`, `Swipe`, `TouchDown`, `TouchMove`, `TouchUp`, `ClickKey`, `InputText`, `KeyDown`, `KeyUp` 方法。

**接口定义**
```go
type CustomController interface {
    Connect() bool
    RequestUUID() (string, bool)
    GetFeature() ControllerFeature
    StartApp(intent string) bool
    StopApp(intent string) bool
    Screencap() (image.Image, bool)
    Click(x, y int32) bool
    Swipe(x1, y1, x2, y2, duration int32) bool
    TouchDown(contact, x, y, pressure int32) bool
    TouchMove(contact, x, y, pressure int32) bool
    TouchUp(contact int32) bool
    ClickKey(keycode int32) bool
    InputText(text string) bool
    KeyDown(keycode int32) bool
    KeyUp(keycode int32) bool
}
```

**Section sources**
- [custom_recognition.go](file://custom_recognition.go#L46-L54)
- [custom_action.go](file://custom_action.go#L46-L48)
- [custom_controller.go](file://custom_controller.go#L48-L64)

## 事件回调

事件回调机制允许用户注册回调函数以接收框架的各种事件通知。`AddSink` 方法用于添加事件回调接收器。

### TaskerEventSink
任务管理器事件回调接口。

**方法**
- `OnResourceLoading(tasker *Tasker, status EventStatus, detail ResourceLoadingDetail)`
- `OnControllerAction(tasker *Tasker, status EventStatus, detail ControllerActionDetail)`
- `OnTaskerTask(tasker *Tasker, status EventStatus, detail TaskerTaskDetail)`
- `OnNodePipelineNode(tasker *Tasker, status EventStatus, detail NodePipelineNodeDetail)`
- `OnNodeRecognitionNode(tasker *Tasker, status EventStatus, detail NodeRecognitionNodeDetail)`
- `OnNodeActionNode(tasker *Tasker, status EventStatus, detail NodeActionNodeDetail)`
- `OnTaskNextList(tasker *Tasker, status EventStatus, detail NodeNextListDetail)`
- `OnTaskRecognition(tasker *Tasker, status EventStatus, detail NodeRecognitionDetail)`
- `OnTaskAction(tasker *Tasker, status EventStatus, detail NodeActionDetail)`
- `OnUnknownEvent(tasker *Tasker, msg, detailsJSON string)`

### ResourceEventSink
资源事件回调接口。

**方法**
- `OnResourceLoading(resource *Resource, status EventStatus, detail ResourceLoadingDetail)`
- `OnControllerAction(resource *Resource, status EventStatus, detail ControllerActionDetail)`
- `OnTaskerTask(resource *Resource, status EventStatus, detail TaskerTaskDetail)`
- `OnNodePipelineNode(resource *Resource, status EventStatus, detail NodePipelineNodeDetail)`
- `OnNodeRecognitionNode(resource *Resource, status EventStatus, detail NodeRecognitionNodeDetail)`
- `OnNodeActionNode(resource *Resource, status EventStatus, detail NodeActionNodeDetail)`
- `OnTaskNextList(resource *Resource, status EventStatus, detail NodeNextListDetail)`
- `OnTaskRecognition(resource *Resource, status EventStatus, detail NodeRecognitionDetail)`
- `OnTaskAction(resource *Resource, status EventStatus, detail NodeActionDetail)`
- `OnUnknownEvent(resource *Resource, msg, detailsJSON string)`

### ControllerEventSink
控制器事件回调接口。

**方法**
- `OnResourceLoading(controller *Controller, status EventStatus, detail ResourceLoadingDetail)`
- `OnControllerAction(controller *Controller, status EventStatus, detail ControllerActionDetail)`
- `OnTaskerTask(controller *Controller, status EventStatus, detail TaskerTaskDetail)`
- `OnNodePipelineNode(controller *Controller, status EventStatus, detail NodePipelineNodeDetail)`
- `OnNodeRecognitionNode(controller *Controller, status EventStatus, detail NodeRecognitionNodeDetail)`
- `OnNodeActionNode(controller *Controller, status EventStatus, detail NodeActionNodeDetail)`
- `OnTaskNextList(controller *Controller, status EventStatus, detail NodeNextListDetail)`
- `OnTaskRecognition(controller *Controller, status EventStatus, detail NodeRecognitionDetail)`
- `OnTaskAction(controller *Controller, status EventStatus, detail NodeActionDetail)`
- `OnUnknownEvent(controller *Controller, msg, detailsJSON string)`

### ContextEventSink
上下文事件回调接口。

**方法**
- `OnResourceLoading(context *Context, status EventStatus, detail ResourceLoadingDetail)`
- `OnControllerAction(context *Context, status EventStatus, detail ControllerActionDetail)`
- `OnTaskerTask(context *Context, status EventStatus, detail TaskerTaskDetail)`
- `OnNodePipelineNode(context *Context, status EventStatus, detail NodePipelineNodeDetail)`
- `OnNodeRecognitionNode(context *Context, status EventStatus, detail NodeRecognitionNodeDetail)`
- `OnNodeActionNode(context *Context, status EventStatus, detail NodeActionNodeDetail)`
- `OnTaskNextList(context *Context, status EventStatus, detail NodeNextListDetail)`
- `OnTaskRecognition(context *Context, status EventStatus, detail NodeRecognitionDetail)`
- `OnTaskAction(context *Context, status EventStatus, detail NodeActionDetail)`
- `OnUnknownEvent(context *Context, msg, detailsJSON string)`

### AddSink
添加事件回调接收器并返回接收器ID。接收器ID可用于稍后移除接收器。

**函数签名**
```go
func (t *Tasker) AddSink(sink TaskerEventSink) int64
func (r *Resource) AddSink(sink ResourceEventSink) int64
func (c *Controller) AddSink(sink ControllerEventSink) int64
func (ctx *Context) AddSink(sink ContextEventSink) int64
```

**参数**
- `sink` (interface{})：事件回调接收器。

**返回值**
- `int64`：接收器ID。

**使用示例**
```go
sinkID := tasker.AddSink(&MyEventSink{})
```

### RemoveSink
通过接收器ID移除事件回调接收器。

**函数签名**
```go
func (t *Tasker) RemoveSink(sinkId int64)
func (r *Resource) RemoveSink(sinkId int64)
func (c *Controller) RemoveSink(sinkId int64)
func (ctx *Context) RemoveSink(sinkId int64)
```

**参数**
- `sinkId` (int64)：接收器ID。

**使用示例**
```go
tasker.RemoveSink(sinkID)
```

### ClearSinks
清除所有事件回调接收器。

**函数签名**
```go
func (t *Tasker) ClearSinks()
func (r *Resource) ClearSinks()
func (c *Controller) ClearSinks()
func (ctx *Context) ClearSinks()
```

**使用示例**
```go
tasker.ClearSinks()
```

**Section sources**
- [event.go](file://event.go#L41-L280)
- [tasker.go](file://tasker.go#L357-L394)
- [resource.go](file://resource.go#L345-L382)
- [controller.go](file://controller.go#L279-L298)
- [context.go](file://context.go#L203-L204)

## 上下文操作

`Context` 结构体提供了在任务执行过程中进行各种操作的方法，如运行任务、识别、操作，以及覆盖管道和下一个列表。

### RunTask
运行一个任务并返回其详细信息。它接受一个入口字符串和一个可选的覆盖参数，该参数可以是JSON字符串或任何可以编组为JSON的数据类型。如果提供多个覆盖，则只使用第一个。

**函数签名**
```go
func (ctx *Context) RunTask(entry string, override ...any) *TaskDetail
```

**参数**
- `entry` (string)：任务入口名称。
- `override` (...any)：任务配置覆盖。

**返回值**
- `*TaskDetail`：任务详细信息。

**使用示例**
```go
detail := ctx.RunTask("Startup", map[string]interface{}{
    "Task": map[string]interface{}{
        "action": "Click",
        "target": []int{100, 200, 100, 100},
    },
})
```

### RunRecognition
运行一个识别并返回其详细信息。它接受一个入口字符串和一个可选的覆盖参数，该参数可以是JSON字符串或任何可以编组为JSON的数据类型。如果提供多个覆盖，则只使用第一个。

**函数签名**
```go
func (ctx *Context) RunRecognition(entry string, img image.Image, override ...any) *RecognitionDetail
```

**参数**
- `entry` (string)：识别入口名称。
- `img` (image.Image)：输入图像。
- `override` (...any)：识别配置覆盖。

**返回值**
- `*RecognitionDetail`：识别详细信息。

**使用示例**
```go
detail := ctx.RunRecognition("MyOCR", img, map[string]interface{}{
    "MyOCR": map[string]interface{}{
        "roi": []int{100, 100, 200, 300},
    },
})
```

### RunAction
运行一个操作并返回其详细信息。它接受一个入口字符串和一个可选的覆盖参数，该参数可以是JSON字符串或任何可以编组为JSON的数据类型。如果提供多个覆盖，则只使用第一个。

**函数签名**
```go
func (ctx *Context) RunAction(entry string, box Rect, recognitionDetail string, override ...any) *ActionDetail
```

**参数**
- `entry` (string)：操作入口名称。
- `box` (Rect)：操作区域。
- `recognitionDetail` (string)：识别详细信息。
- `override` (...any)：操作配置覆盖。

**返回值**
- `*ActionDetail`：操作详细信息。

**使用示例**
```go
detail := ctx.RunAction("Click", maa.Rect{100, 200, 100, 100}, "", map[string]interface{}{
    "Click": map[string]interface{}{
        "target": []int{100, 200, 100, 100},
    },
})
```

### OverridePipeline
覆盖管道配置。`override` 参数可以是JSON字符串或任何可以编组为JSON的数据类型。

**函数签名**
```go
func (ctx *Context) OverridePipeline(override any) bool
```

**参数**
- `override` (any)：管道覆盖配置。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctx.OverridePipeline(map[string]interface{}{
    "Task": map[string]interface{}{
        "recognition": "TemplateMatch",
        "template": "template.png",
    },
})
```

### OverrideNext
覆盖任务的下一个列表。

**函数签名**
```go
func (ctx *Context) OverrideNext(name string, nextList []string) bool
```

**参数**
- `name` (string)：任务名称。
- `nextList` ([]string)：下一个任务列表。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctx.OverrideNext("Task1", []string{"TaskA", "TaskB"})
```

### OverrideImage
覆盖图像。

**函数签名**
```go
func (ctx *Context) OverrideImage(imageName string, image image.Image) bool
```

**参数**
- `imageName` (string)：图像名称。
- `image` (image.Image)：图像实例。

**返回值**
- `bool`：覆盖成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctx.OverrideImage("template", img)
```

### GetNodeJSON
根据名称获取节点JSON。

**函数签名**
```go
func (ctx *Context) GetNodeJSON(name string) (string, bool)
```

**参数**
- `name` (string)：节点名称。

**返回值**
- `string`：节点JSON字符串。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
jsonStr, ok := ctx.GetNodeJSON("Task1")
if ok {
    fmt.Println(jsonStr)
}
```

### GetNodeData
根据名称获取节点数据。

**函数签名**
```go
func (ctx *Context) GetNodeData(name string) (*Node, error)
```

**参数**
- `name` (string)：节点名称。

**返回值**
- `*Node`：节点数据。
- `error`：错误信息。

**使用示例**
```go
node, err := ctx.GetNodeData("Task1")
if err != nil {
    log.Fatal(err)
}
```

### GetTaskJob
返回当前任务作业。

**函数签名**
```go
func (ctx *Context) GetTaskJob() *TaskJob
```

**返回值**
- `*TaskJob`：当前任务作业。

**使用示例**
```go
job := ctx.GetTaskJob()
```

### GetTasker
返回当前任务管理器。

**函数签名**
```go
func (ctx *Context) GetTasker() *Tasker
```

**返回值**
- `*Tasker`：当前任务管理器。

**使用示例**
```go
tasker := ctx.GetTasker()
```

### Clone
克隆当前上下文。

**函数签名**
```go
func (ctx *Context) Clone() *Context
```

**返回值**
- `*Context`：克隆的上下文。

**使用示例**
```go
newCtx := ctx.Clone()
```

### SetAnchor
设置锚点。

**函数签名**
```go
func (ctx *Context) SetAnchor(anchorName, nodeName string) bool
```

**参数**
- `anchorName` (string)：锚点名称。
- `nodeName` (string)：节点名称。

**返回值**
- `bool`：设置成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctx.SetAnchor("start", "Task1")
```

### GetAnchor
获取锚点。

**函数签名**
```go
func (ctx *Context) GetAnchor(anchorName string) (string, bool)
```

**参数**
- `anchorName` (string)：锚点名称。

**返回值**
- `string`：节点名称。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
nodeName, ok := ctx.GetAnchor("start")
if ok {
    fmt.Printf("Anchor: %s\n", nodeName)
}
```

### GetHitCount
获取节点的命中次数。

**函数签名**
```go
func (ctx *Context) GetHitCount(nodeName string) (uint64, bool)
```

**参数**
- `nodeName` (string)：节点名称。

**返回值**
- `uint64`：命中次数。
- `bool`：获取成功返回 `true`，否则返回 `false`。

**使用示例**
```go
count, ok := ctx.GetHitCount("Task1")
if ok {
    fmt.Printf("Hit count: %d\n", count)
}
```

### ClearHitCount
清除节点的命中次数。

**函数签名**
```go
func (ctx *Context) ClearHitCount(nodeName string) bool
```

**参数**
- `nodeName` (string)：节点名称。

**返回值**
- `bool`：清除成功返回 `true`，否则返回 `false`。

**使用示例**
```go
success := ctx.ClearHitCount("Task1")
```

**Section sources**
- [context.go](file://context.go#L39-L239)

## 状态与作业

`Status` 类型表示任务或项目的生命周期状态。`Job` 和 `TaskJob` 结构体提供了异步作业的状态跟踪功能。

### Status
表示任务或项目的生命周期状态。

**常量**
- `StatusInvalid`：未知或未初始化状态。
- `StatusPending`：已排队但尚未开始。
- `StatusRunning`：工作正在进行中。
- `StatusSuccess`：成功完成。
- `StatusFailure`：完成但失败。

### Job
表示具有状态跟踪功能的异步作业。

**方法**
- `Status()`：返回作业的当前状态。
- `Invalid()`：报告状态是否无效。
- `Pending()`：报告状态是否挂起。
- `Running()`：报告状态是否正在运行。
- `Success()`：报告状态是否成功。
- `Failure()`：报告状态是否失败。
- `Done()`：报告作业是否完成（成功或失败）。
- `Wait()`：阻塞直到作业完成并返回作业实例。

### TaskJob
扩展 `Job` 以提供任务特定的功能，如获取任务详细信息。

**方法**
- `Wait()`：阻塞直到任务作业完成并返回 `TaskJob` 实例。
- `GetDetail()`：检索任务的详细信息。

**Section sources**
- [status.go](file://status.go#L3-L60)
- [job.go](file://job.go#L3-L95)