# MPE Desktop 集成边界

仅在 MaaPipelineEditor 中使用这些项目约束；通用 Tauri 项目不继承它们。需求唯一维护入口是 [MPE Desktop 需求定位](../../../../dev/docs/MPE%20Desktop需求定位.md)，此处用于把产品概念映射到开发决策。

## 启动器与渲染器

- **启动器**提供新管理界面，负责项目、版本、安装更新、实例冲突和 mpelb 生命周期。已选用 React + TypeScript + Vite、Tailwind CSS + shadcn/ui，具有独立于 Editor 的样式与组件体系；视觉方向及参考对象见需求文档“启动器视觉方向”。
- **渲染器**承载所选版本的现有 Web Editor；不新增一套画布、表单或编辑器组件，不要求为了桌面端重新实现 Web UI。必要的桌面衔接保持为宿主边界适配。
- 启动器 UI 随 MPE Desktop 发布；Editor 资源随用户所选 MPE 版本切换。不要将 Editor 永久绑定到 MPE Desktop 的内置 `frontendDist`，导致无法独立切换。
- 分工不预先决定窗口数、进程数或可执行文件数。实施时明确管理窗口与编辑窗口的生命周期、权限及资源入口；单例约束作用于整套 MPE Desktop，不要求所有功能挤在一个窗口。
- 窗口关系由启动器设置控制，包括开始编辑后管理窗口的行为、结束编辑后返回启动器或退出；具体选项和默认值按需求文档及界面设计确定。不将管理窗口关闭等同于整个 MPE Desktop 退出，不引入托盘驻留；结束渲染会话需停止后端，整套 MPE Desktop 退出必须清理其管理的服务。
- 项目通过用户添加目录持久登记到列表，支持后续快捷选择；首版不创建项目。安装检查与修复位于独立的依赖/引擎管理区，首次检查可跳过，选择检查且缺失环境时接续安装最新稳定版配套资源。
- 首页兼有宣传功能，包含背景自定义、轮播及兄弟项目推荐等内容。mpelb 配置仅提供打开配置文件及文档入口，不复制 Editor 中的配置界面。

## 服务与版本

- 复用全局 mpelb 安装和统一依赖管理能力。它是外部安装的程序，不因 Tauri 支持 sidecar 就默认将它作为 `bundle.externalBin` 再打包一份。
- MPE Desktop 和 mpelb 服务各自单例。重复 MPE Desktop 启动提示并拒绝，不激活旧窗口或传递打开请求；mpelb 冲突由启动器展示，只有用户选择中断后才停止旧服务并启动新服务。
- Editor 与 mpelb 必须同版本；MPE Desktop 可以不同版本。前后端切换作用于全局安装，不引入按项目并行版本。
- MPE Desktop 的 updater 负责 MPE Desktop 包；前后端版本选择与恢复复用统一安装更新流程。不要把 MPE Desktop 的更新版本检查等同于 MPE 的版本选择。
- 自动检查并更新默认开启且可配置，固定版本优先。仅在渲染器未运行时更新，成功后立即生效；更新与启动渲染器互斥。MPE Desktop 内 Editor 隐藏更新提醒，启动器提供克制的提示，独立 Web 行为保持不变。

## 仓库入口

从仓库根目录定位：`Editor/`、`LocalBridge/`、`scripts/install/`、`.github/workflows/release.yaml`。桌面目录尚未确定时不要假设已存在 `Desktop/`。

需要社区组织方式参考时，读取 `dev/docs/社区参考项目索引.md`，按索引查看本地 MXU、MaaLogAnalyzer；框架 API 语义仍以 Tauri 官方资料为准。

开发沿用 yarn、中文交流、交互手动测试和按职责拆分文件的仓库约定。支持 Windows/macOS，发布架构对齐 mpelb；不扩展 Linux GUI、移动端或托盘。
