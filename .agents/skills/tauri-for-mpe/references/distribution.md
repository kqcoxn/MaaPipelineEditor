# 更新与分发

核对日期：2026-09-18。Tauri 配置和插件选项以项目锁定版本及下列官方资料为准，不复制 Tauri v1 更新配置。

## MPE Desktop 自身更新

依据：[官方 Updater](https://v2.tauri.app/plugin/updater/)。

- 注册 updater 插件并按调用方式配置权限、更新端点及签名公钥。`bundle.createUpdaterArtifacts` 决定生成更新产物。
- 更新包需要 Tauri 更新签名，不能关闭签名验证；公钥配置填写公钥内容而非文件路径。私钥与密码由构建环境提供，不写入前端、清单或仓库。
- 生产端点使用 HTTPS。区分静态更新 JSON 与动态响应格式，按所选模式核对版本、平台、架构、下载 URL 和签名。
- macOS 更新产物是 `.app.tar.gz` 及签名；`.dmg` 用于安装分发。Windows v2 更新使用相应 NSIS `.exe` 或 `.msi` 及签名。不要混用旧版兼容产物格式。
- 下载、安装和应用重启是不同阶段，需在应用工作状态允许时执行。不要沿用 v1 的内置 updater 对话框配置。

- 项目使用 `Desktop/desktop-release.json` 中的 `desktopRevision` 判断桌面更新；`minimumDesktopRevision` 表达前后端最低宿主要求。产品版本迁移不递增修订号，桌面改动通过 `yarn desktop:revision` 递增；最低要求单独维护。

## MPE 前后端版本切换

以下是项目设计约束，不是 updater 插件自动提供的能力：

- MPE Desktop 包含启动器 UI 与渲染宿主；独立下载的 Editor 和全局 mpelb 由统一安装更新流程协调。
- 仅在渲染器未运行时更新，下载并校验完整目标组，确认服务停止后替换；成功立即生效，不等下次启动再切换。更新与启动渲染器互斥，完成更新不自动打开编辑器；下一次启动时确认服务和版本就绪。中途失败不得把前后端不同版本视为可用。
- 所选版本固定时不追随最新稳定版；用户手动选择较低版本也不等同于 MPE Desktop updater 的默认升级检查。
- 自动检查并更新是默认开启的设置项，用户可关闭，且不能覆盖固定版本。更新提醒只在启动器克制呈现，MPE Desktop 承载的 Editor 不再提醒更新，独立 Web 不受影响。
- 定义可恢复的当前版本记录与切换状态；避免启动器崩溃后只剩一半已替换的文件。恢复范围需包含相关运行依赖，不能只回滚 mpelb 文件名。
- MPE Desktop 自身更新同样仅在渲染器未运行时进行，并协调后端退出。Tauri updater 不自动实现用户内容保存或外部服务清理。

## Windows 与 macOS 交付

依据：[Windows 安装器](https://v2.tauri.app/distribute/windows-installer/)、[macOS 签名](https://v2.tauri.app/distribute/sign/macos/)、[官方配置参考](https://v2.tauri.app/reference/config/)。

- 按仓库 mpelb 实际发布矩阵选择 Rust target、安装包和更新清单键，不因模板默认值扩大平台范围。
- Windows 检查 WebView2 部署选项与安装器行为；安装包成功生成不代表目标机器上具备运行条件。
- macOS 按分发渠道处理代码签名与公证。操作系统代码签名和 updater 更新签名是不同机制，不能互相替代。
- 在对应系统验证安装、更新、卸载及全局 mpelb 路径发现；声明未能在当前主机验证的平台项目。
- 首次安装、正常升级、固定版本、主动换版本、下载失败、服务停止失败及重启失败，应覆盖有意义的状态转换。GUI 验证遵守仓库手动测试约定。
