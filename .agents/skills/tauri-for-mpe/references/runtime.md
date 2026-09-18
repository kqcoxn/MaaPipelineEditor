# 宿主与运行时

核对日期：2026-09-18。下列为官方资料的决策摘要；标注为项目建议的部分不是 Tauri 框架保证。

## WebView 与资源入口

依据：[进程模型](https://v2.tauri.app/zh-cn/concept/process-model/)、[前端配置](https://tauri.app/zh-cn/start/frontend/)、[配置参考](https://v2.tauri.app/reference/config/)。

- Tauri Core 协调系统与窗口，WebView 使用平台 Web 引擎承载 UI。产品职责拆分不等于操作系统进程一一对应。
- `build.devUrl` 对应开发服务，`build.frontendDist` 对应生产前端资源。构建时内置资源与运行时下载的 Editor 版本目录是不同来源，不能以修改编译期配置代替运行时版本选择。
- 项目建议：为管理 UI 与 Editor 分别确定资源入口、窗口标签和权限。动态 Editor 加载需要明确路由回退、资源 MIME、来源、WebSocket 连接与 CSP；不要把资源目录存在等同于可正确渲染。
- 项目建议：需要动态本地资源时，依据配置/API 选择自定义协议或本地服务，不预设必须开启 localhost 服务；若使用服务，检查其生命周期与访问范围。

## IPC 与状态

依据：[从前端调用 Rust](https://v2.tauri.app/zh-cn/develop/calling-rust/)、[从 Rust 调用前端](https://v2.tauri.app/develop/calling-frontend/)、[状态管理](https://v2.tauri.app/develop/state-management/)。

- 命令需注册到 `generate_handler!`。参数需可反序列化，返回值及错误需可序列化；`invoke` 返回 Promise。
- 顶层命令参数默认按 camelCase 从 JS 传入；嵌套结构体字段遵循 Serde 自身规则，需要时显式使用 `#[serde(rename_all = "camelCase")]`，不假设自动递归转换。
- 请求与返回使用命令；状态通知使用事件；持续进度或数据流考虑 Channel。组件销毁时解除事件监听。
- 状态通过 `manage` / `State<T>` 共享，注册与读取的类型必须一致。仅在需要共享可变数据时选择适当锁；短临界区可使用普通 Mutex，不把所有状态一律改成异步锁。
- 避免阻塞 UI 与异步执行线程。异步 I/O、阻塞任务和 CPU 工作分别使用适当机制；仅添加 `async` 不会让同步耗时操作自动离开当前线程。
- 异步参数优先使用拥有所有权的类型；确需引用或 `State` 时查官方命令文档的限制，不把“异步完全禁止借用”作为规则。

## 权限边界

依据：[Capabilities](https://v2.tauri.app/zh-cn/security/capabilities/)、[Permissions](https://v2.tauri.app/security/permissions/)。

- 插件的前端调用需要匹配的权限与 scope。插件 `default` 权限不意味着放开全部命令，具体标识查对应插件页面。
- 应用通过 `invoke_handler` 注册的自定义命令默认可由应用窗口/WebView 调用；不能仅拆分 capability 文件就宣称已隔离管理命令。需要限制时核对 `AppManifest::commands`、自定义权限及调用来源检查。
- 项目建议：启动器需要的安装、更新、进程管理权限不默认授予 Editor。Rust 直接执行系统操作也不能依赖前端插件 ACL 代替输入与调用者校验。
- 不用关闭 CSP 或广泛授权远端来源修复资源加载错误；先核对实际来源和通信需求，再配置必要范围。

## 单例与进程

依据：[Single Instance](https://v2.tauri.app/plugin/single-instance/)、[Shell](https://v2.tauri.app/plugin/shell/)、[Process](https://v2.tauri.app/plugin/process/)。

- 单例插件应先于其他插件注册。其回调在已有实例收到新启动尝试时执行，新实例会被关闭；聚焦旧窗口是可选的回调行为，不是必须采用的产品行为。
- MPE 要求提示并拒绝。实现前确认提示由哪个进程显示；若要求新进程退出前自行弹窗，不能假设单例回调运行在新进程。不要照搬 `set_focus()` 示例。
- 单例插件只约束对应 Tauri 应用，不替 mpelb 提供单例。mpelb 服务锁与只读 CLI 命令的并行行为需在后端分别实现。
- Shell 用于启动外部命令；Process 插件用于 MPE Desktop 自身退出和重启，并不是通用子进程管理器。
- 项目建议：宿主保有实际子进程句柄，分别管理启动中、就绪、停止中、退出和失败状态；服务就绪依靠握手/状态而非固定延迟。结构化传递程序参数，避免拼接 shell 字符串。
- 项目建议：正常退出与异常死亡分别设计清理机制。不能假设窗口关闭、Rust 句柄释放或 MPE Desktop 崩溃一定终止外部服务；Windows/macOS 均需实际验证。
