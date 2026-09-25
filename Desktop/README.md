# MPE Desktop

MPE Desktop 使用一个 Tauri 2 宿主承载独立启动器与现有 Web Editor。启动器负责项目、全局环境和更新；Editor 的业务界面仍在 `Editor/` 中维护。

## 开发

需要 Node.js、Yarn 1、Rust stable、Go（版本见 LocalBridge/go.mod），以及 [Tauri 平台前置工具](https://tauri.app/zh-cn/start/prerequisites/)。

```sh
yarn desktop:install
yarn --cwd Desktop build
cargo check --manifest-path Desktop/src-tauri/Cargo.toml
yarn desktop:test
```

准备真实编辑会话时，先准备与 `mfwVersion` 对应的 runtime，再执行：

```sh
yarn editor:install
yarn desktop:prepare [runtime目录]
yarn desktop:dev
```

`desktop:prepare` 构建 Editor 和 mpelb，默认从现有全局安装读取 runtime，经统一安装事务替换**全局** mpelb、Editor 与 runtime。此操作需要所有 mpelb 服务停止，会影响随后终端使用的版本。它不是开发服务器，也不自动打开 MPE Desktop。未发布首个配套清单前，使用此入口验证本地源码；安装界面的在线版本来自实际 GitHub Release。

`desktop:dev` 和 `desktop:build` 分别用于手动启动开发界面和生成本机安装包。不要自动启动 GUI 或浏览器测试。

## 边界与接口

- `src/`：React 管理界面；`src-tauri/src/`：设置、资源协议、服务生命周期、环境协调和更新。
- Editor 使用 `mpe://localhost` 固定来源加载，Windows 上由 WebView 映射为 `http://mpe.localhost`。只允许读取当前 Editor 目录中的资源。
- `window.__MPE_DESKTOP__` 由宿主注入，携带版本、项目标识及托管服务地址。关闭使用 `desktop-close-request` 和 `desktop_reply`，保存路径由原生对话框提供。
- 启动器与 Editor 使用不同 capability；自定义命令通过 AppManifest 注册权限，并再次验证调用窗口与来源。
- 启动器不显示网页右键菜单。渲染器保留 Editor 右键操作，并支持按 F12 打开开发者工具（含正式构建）；macOS 功能键模式下可能需要 Fn + F12。
- MPE Desktop 默认编辑时隐藏启动器，结束编辑后停止服务并退出；可在设置中调整。没有托盘。
- mpelb 控制服务使用当前用户目录中的内核锁与私有发现记录。随机凭据、实例 ID 和本机 HTTP 控制通道用于状态和停止，端口或 PID 文件本身不是实例存活依据。
- MPE Desktop 通过 stdin 生命周期管道托管后端，Windows 额外使用关闭时终止的 Job Object。父进程消失后后端请求正常清理，清理超时退出。
- WebView 进程崩溃使用 WebView2 / WKWebView 的平台回调停止后端并返回启动器；仅长时间未响应时显示恢复提示，避免将计算繁忙误判为崩溃。

## 安装与恢复

统一实现位于 LocalBridge 的 `internal/install`。引导脚本只下载已校验的 mpelb，CLI 和 MPE Desktop 都调用同一个安装事务。纯 CLI 环境默认只安装 mpelb 与运行依赖，不下载 Editor；MPE Desktop 安装和检查时显式传入 `--with-editor`。已安装的 Editor 会随之后的 CLI 环境更新保持同版本，依赖修复不下载或修改 Editor。

```sh
mpelb env check --with-editor --json
mpelb env install --with-editor --version latest --json
mpelb env install --with-editor --version 2.0.0 --json
mpelb env recover --json
mpelb service status --json
mpelb service stop --json
mpelb service stop --id <实例ID> --force --json
mpelb deps reinstall all
```

示例版本需存在实际的完整发布清单。Windows 从已安装的 mpelb 自更新时会启动临时副本，原进程退出后由该副本完成安装；以输出的 `complete` 事件为完成依据。MPE Desktop 直接运行临时安装工具并等待其结束。

安装目录仍为 Windows `%LOCALAPPDATA%/mpelb`、macOS/Linux `~/.local/bin`。基础资源为 `mpelb`、`runtime/` 和 `mpe-install.json`，桌面环境另含 `editor/`。下载和替换使用同目录 `.mpe-transaction/`，持久记录备份与提交状态；服务发现未完成事务时拒绝启动，环境检查可恢复。备份与暂存不是多版本仓库。

更新固定版本不会改变用户选择；自动更新只在没有渲染器时执行。首次跳过环境检查不安装资源。安装和启动在 MPE Desktop 内互斥，同时受跨进程安装锁保护。

托管 LocalBridge 仅监听本机回环地址，由系统分配空闲端口；桌面编辑器通过服务发现读取实际连接地址。

## 首页内容与视觉

Landing 的 `public/mpe-desktop.json` 随展示站点发布。MPE Desktop 请求该地址，缓存有效内容，失败时使用缓存或编译进 MPE Desktop 的同份默认内容。内容只包含文本、图片和 HTTPS 链接，不支持远程脚本。推荐项表达相关项目，不表示合作或背书。

布局参考 PCL 的项目/版本入口、BakaXL 的资讯区域和游戏启动器的固定启动区。参考入口：[PCL](https://github.com/Meloong-Git/PCL)、[BakaXL 官方帮助](https://help.bakaxl.com/en/v3/)。实际素材使用 MPE 自有标识和 Editor 截图。

## 发布

Release 流水线生成 Windows x64 NSIS、macOS arm64 DMG、对应 MPE Desktop 更新资源，以及三平台 mpelb 配套环境。Go 打包器统一整理 MaaFramework、MaaAgentBinary 和 OCR，生成 SHA256 校验与 `mpe-manifest.json`。Editor 构建内的 `mpe-build.json` 必须与发布版本一致。

每个平台的 `mpe-environment-<平台>.zip` 仅包含 mpelb 和 runtime，`MaaPipelineEditor-*-stable.zip` 由 Web 自部署与所有平台的桌面安装共享。清单的 `platforms.<平台>.bundle` 描述基础包，顶层 `editor` 描述 Editor 下载地址及校验值；发布索引校验两类产物完整后才收录版本。桌面安装在同一事务中校验、替换两类资源，任何一步失败均恢复之前的环境。

运行 `yarn migrate` 同步 Editor、MPE Desktop 配置、Cargo 与仓库发布版本；该命令不修改桌面修订号。

桌面更新由 `Desktop/desktop-release.json` 单独控制：

- `desktopRevision`：桌面端的发布修订号。启动器界面、Rust 宿主、内置资源或依赖有需要用户接收的改动时，执行 `yarn desktop:revision` 加一，再提交配置文件。
- `minimumDesktopRevision`：当前 MPE 前后端所需的最低桌面修订号。只有前后端确实依赖新的宿主能力时才手动提高，不能超过当前修订号；递增脚本不会自动提高它。

构建将修订号嵌入宿主；发布脚本将其写入 `mpe-desktop-updater.json`。环境打包和 `desktop:prepare` 读取同一配置，把最低要求写入 `mpe-manifest.json`。管理协议版本独立校验。

产品版本号更高但修订号相同或更低时，不下载、不安装、不重启 MPE Desktop；只有远端修订号更高才通过 Tauri 执行签名校验和安装。清单缺失或包含无效修订号会报错，不按产品版本号兜底升级。产品版本仍显示实际安装包版本，修订号记录在启动日志和日志包的 `desktop.txt` 中。

发布流水线仍为每个稳定版本构建安装包和清单，供新用户下载；已有用户是否更新由修订号决定。发布桌面改动前必须递增修订号；单纯前后端更新无需执行递增命令。

正式 tag 构建需要：

- Repository variable：`MPE_UPDATER_PUBLIC_KEY`。
- Secrets：`TAURI_SIGNING_PRIVATE_KEY`、可选的 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

macOS 安装包在流水线中使用临时签名，不需要仓库提供 Apple 证书或公证凭据。开发者如需正式签名与公证，可下载构建产物后自行处理；临时签名的安装包可能需要用户在系统隐私与安全性设置中手动允许打开。Tauri 更新产物仍使用上述独立密钥签名。

签名私钥由维护者保存，不提交仓库。缺少正式发布配置时流水线失败，不发布不完整的更新清单。手动工作流允许构建未配置更新签名的验收产物；这些产物不能用来验证正式自动更新。

## 手动验收

分别在 Windows x64、macOS arm64 检查：

1. 首次跳过不安装；主动检查缺少环境时安装；项目添加、重启持久化、移除不删文件、路径重新定位。
2. 重复 MPE Desktop 提示并退出新实例；已有终端服务不被接管；正常中断并重连；超时后才强制结束；取消冲突不影响原服务。
3. 启动当前项目，检查服务自动连接、画布、Monaco、图片、调试与文件保存；断网后仍能打开已准备的 Editor。
4. 编辑已有文件或新文件后直接关闭，不弹出保存确认；重新打开确认编辑缓存恢复及项目缓存隔离；运行任务时检查停止任务退出提示及取消退出。
5. 四种窗口设置组合、关闭管理窗口、整体退出、后端意外退出、强制结束 MPE Desktop 后无孤立后端。
6. 固定旧版本、跟随稳定版、关闭自动更新；编辑时不能更新；下载损坏、替换失败和事务中断恢复；确认终端 mpelb 同步切换。
7. 首页远程内容、断网兜底、轮播、自定义背景、主题、外部链接与配置入口。
8. 签名安装包的首次安装、升级与卸载；两个真实版本间的 MPE Desktop 自动更新。大图拖动、缩放和调试表现记录实际结果。

跨平台编译检查不代替平台上的 GUI、安装、签名和升级验收。

本次实现的自动验证与待验收范围见 [验收记录](../dev/docs/MPE%20Desktop验收记录.md)。
