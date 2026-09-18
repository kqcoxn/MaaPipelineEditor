---
name: tauri-for-mpe
description: "以官方文档为基准开发 Tauri v2 桌面应用，涵盖 WebView 集成、Rust IPC、权限、进程生命周期与更新分发。用于 Tauri 配置、宿主能力和桌面构建工作；纯 Web 组件或 Go 服务内部实现不单独触发。"
---

# Tauri 桌面开发

本技能由项目自行维护，不是 Tauri 官方发布的技能。以 [Tauri 官方中文文档](https://tauri.app/zh-cn/start/) 为起点，按当前任务核对官方 API 与项目锁定版本；不以社区 Skill 的示例作为 API 依据。

## 工作入口

1. 先识别改动属于管理界面、Web 内容承载、Rust 宿主、外部服务还是发布流程。检查已有目录、`Cargo.toml` / `Cargo.lock`、前端依赖和 `tauri.conf.*`；尚未搭建时不要把建议目录当成现有代码。
2. 在 MaaPipelineEditor 中先读 [MPE Desktop 需求定位](../../../dev/docs/MPE%20Desktop需求定位.md)。产品决策以该文档和用户最新要求为准，项目边界见 [MPE Desktop 集成](references/mpe-desktop.md)。
3. 按下表仅加载相关参考。具体配置项、权限标识和签名随版本可能变化，实施前打开对应官方页面；中文页缺失或不完整时核对同主题英文页和链接到的 Rust API 文档。
4. 复用现有模块完成改动，验证涉及的边界和失败路径。技能不授权自动启动桌面应用、开发服务器或浏览器；遵循仓库的手动交互测试约定。

| 工作内容 | 按需参考 |
| --- | --- |
| 启动器与渲染器分工、全局 mpelb、项目约束 | [MPE Desktop 集成](references/mpe-desktop.md) |
| WebView 资源、IPC、状态、权限、单例、子进程 | [宿主与运行时](references/runtime.md) |
| 自动更新、产物、签名、Windows/macOS 发布 | [更新与分发](references/distribution.md) |

## 开发决策

- Tauri 不限定前端框架。新管理界面按用户期望、视觉质量与维护成本选型；承载已有 Web 应用时直接复用其构建产物，不据此强制两个界面使用同一组件库。
- Rust 宿主负责系统操作与生命周期协调，WebView 负责界面。产品中的“启动器/渲染器”是职责名称，不自动对应两个可执行文件或 Tauri 的 Core/WebView 进程划分。
- 对已有仓库使用增量集成，不直接用脚手架覆盖前端或全仓库配置。JavaScript 依赖与命令遵循仓库包管理器，MPE 使用 yarn；Rust 依赖使用 Cargo。
- 新实现采用 v2 API。`invoke` 从 `@tauri-apps/api/core` 导入；不要使用 v1 的 `@tauri-apps/api/tauri`、`tauri::api` 或旧 allowlist 配置。
- 配置以 Tauri 配置 Schema 为准，capability 文件使用对应权限 Schema，两者不能混用。通过当前依赖生成的 Schema 检查字段，不拼接社区示例中的旧配置。
- `main.rs` / `lib.rs` 负责入口和模块装配，命令、状态、进程、更新逻辑按职责分模块；不把所有实现堆入 `lib.rs`。

## 验证与交付

- Rust 改动按影响范围运行 `cargo fmt --check`、`cargo check` 和必要的测试；调用仓库现有的前端类型检查与构建命令验证管理界面及 IPC 契约。
- 重点验证实际状态转换，例如重复启动、停止失败、子进程提前退出、更新失败恢复；不要用仅匹配实现文字的测试替代行为验证。
- 本机通过不等于另一平台通过。Windows/macOS 安装、签名、更新及异常退出需在对应平台验证；明确列出未验证项。
- 前端交互改动交付时列出手动测试步骤，不因本技能而自动运行 GUI 或浏览器。

官方入门链接：[前置要求](https://tauri.app/zh-cn/start/prerequisites/)、[前端配置](https://tauri.app/zh-cn/start/frontend/)、[配置参考](https://v2.tauri.app/reference/config/)。主题参考中的摘要用于定位决策，不替代官方完整文档。
