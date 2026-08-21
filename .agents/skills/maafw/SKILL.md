---
name: maafw
description: MaaFramework 开发与集成指南。当任务涉及 MaaFramework 项目结构、Pipeline 协议、ProjectInterface V2 协议、自定义识别/动作（Custom/Agent）、Python/NodeJS/CSharp 等语言 Binding 集成、控制器配置、回调协议或运行时行为时使用。
---

# MaaFramework 开发指南

## 核心原则

- 以 MaaFramework 官方文档、Schema 和源码为语义首要依据。
- 在 MaaPipelineEditor 仓库中工作时，官方源码默认指 `dev/docs/社区参考项目索引.md` 登记的本地参考仓库；本地克隆与 GitHub 上游属于同一源码来源，不得因需要“官方源码”而绕过本地仓库访问远端。
- 准确区分 Project、Pipeline、Bundle、Resource、Task、Entry、Node、Controller、Tasker、Context、Agent 等概念。
- 不根据旧 MPE 实现反推 MaaFramework 行为；新增或修改 MFW 相关能力前核对当前参考版本的文档与 API。
- 设计 JSON/JSONC 修改流程时考虑注释、格式、字段顺序和精确位置，禁止默认用普通反序列化再整体序列化破坏源文件。

## 本地参考源码

需要参考 MaaFramework 或社区项目实现时：

1. 先完整读取仓库根目录的 `dev/docs/社区参考项目索引.md`，按其中的“按任务选择参考项目”确定项目，并从索引解析本地路径；不要凭记忆猜测目录。
2. 优先使用索引中的本地仓库进行 `rg`、文件读取、`git log`、`git blame` 和版本对比。开始引用前记录其当前 commit；需要判断新旧时再检查本地分支和远端跟踪信息。
3. 本地仓库缺失或明确需要更新时，不要在系统临时目录或其他位置另行 `git clone`。用户要求同步或更新时使用 `sync-reference-projects` skill 的统一流程；只读任务中若版本新旧会实质性影响结论，则说明本地状态并取得同步授权。
4. 仅当索引未收录所需项目，或本地仓库确实无法提供任务所需内容时，才访问 GitHub、Raw URL 或远端 API；访问前说明原因。远端查询不得替代对现有本地参考仓库的检查。

常用本地入口（均以 MaaPipelineEditor 仓库根目录为基准）：

- MaaFramework：`../maa-refs/MaaFramework`
- maa-support-extension（MSE）：`../maa-refs/maa-support-extension`
- 其余项目：以 `dev/docs/社区参考项目索引.md` 为准。

## 参考文档索引

按任务类型选择对应参考文件：

| 任务 | 参考文件 |
|---|---|
| 入门、资源准备、调试运行、项目打包 | [1.1-快速开始.md](references/1.1-快速开始.md) |
| 术语与架构 | [1.2-术语解释.md](references/1.2-术语解释.md) |
| Custom/Agent 扩展 | [1.3-Custom&Agent.md](references/1.3-Custom&Agent.md) |
| 语言 Binding 与集成入口 | [2.1-集成文档.md](references/2.1-集成文档.md) |
| API 接口一览 | [2.2-集成接口一览.md](references/2.2-集成接口一览.md) |
| 回调消息协议 | [2.3-回调协议.md](references/2.3-回调协议.md) |
| 控制器截图/输入方式 | [2.4-控制方式说明.md](references/2.4-控制方式说明.md) |
| Pipeline 节点协议 | [3.1-任务流水线协议.md](references/3.1-任务流水线协议.md) |
| ProjectInterface V2（interface.json） | [3.3-ProjectInterfaceV2协议.md](references/3.3-ProjectInterfaceV2协议.md) |
| 构建 MaaFramework 本体 | [4.1-构建指南.md](references/4.1-构建指南.md) |
| 新语言 Binding 设计 | [4.2-标准化接口设计.md](references/4.2-标准化接口设计.md) |

## 项目结构识别

一个标准 MaaFramework 项目通常包含：

```tree
project/
├── interface.json          # ProjectInterface V2 声明
├── assets/
│   ├── resource/           # Bundle：pipeline/、image/、model/
│   │   ├── pipeline/
│   │   ├── image/
│   │   ├── model/ocr/
│   │   └── default_pipeline.json
│   └── interface_zh.json   # 多语言翻译（可选）
└── agent/                  # Agent 自定义扩展（可选）
```

识别顺序：

1. 确认 `interface.json` 存在并解析 `interface_version`。
2. 解析 `controller`、`resource`、`task`、`option`、`preset`、`group` 等字段。
3. 按 `resource.path` 定位 Bundle，递归读取 `pipeline/` 下所有 JSON/JSONC。
4. 需要运行时信息再加载控制器；静态分析阶段不假设设备已连接。

## Pipeline 处理工作流

1. 读取 `pipeline/` 目录下所有 JSON/JSONC（以 `.` 开头的目录/文件被忽略；以 `$` 开头的 root 字段被忽略）。
2. 解析节点时支持 v1（`recognition`/`action` 字符串及同级参数字段）和 v2（`recognition`/`action` 为 `{ type, param }` 对象）混用。
3. 识别引用关系：`next`、`on_error`、`roi`、`target` 可引用节点名或 `[Anchor]锚点名`。
4. 修改 Pipeline 时：
   - 保留 JSONC 注释与字段顺序；
   - 使用精确位置编辑而非整体重写；
   - 引用变更时同步检查引用目标是否存在。
5. 需要算法/动作字段定义时查阅 [3.1-任务流水线协议.md](references/3.1-任务流水线协议.md)。

## ProjectInterface V2 处理工作流

1. 确认 `interface_version` 为 `2`。
2. 解析核心字段：`name`、`version`、`controller`、`resource`、`task`、`option`、`preset`、`group`、`import`、`agent`、`pretask`、`global_option`、`setting`。
3. 处理 `import` 合并规则：
   - `task`、`preset`、`group`、`pretask`、`setting`：追加；
   - `option`：对象合并，后导入覆盖先导入；
   - `global_option`：追加并按 option 键名去重，保留先出现项。
4. 处理 option 覆盖优先级：`global_option` < `resource.option` < `controller.option` < `task.option`。
5. 启动 Agent 子进程时按 v2.5.0+ 约定注入 `PI_*` 环境变量，详见 [3.3-ProjectInterfaceV2协议.md](references/3.3-ProjectInterfaceV2协议.md) 的 Agent 子进程环境变量小节。
6. 需要字段完整定义时查阅 [3.3-ProjectInterfaceV2协议.md](references/3.3-ProjectInterfaceV2协议.md)。

## 集成与运行时

1. 优先使用项目确定的语言 Binding（如 Python Binding）。
2. 核心对象生命周期：创建 `Resource` → 加载 Bundle → 创建 `Controller` → 连接设备 → 创建 `Tasker` → 绑定 Resource 和 Controller → 执行任务。
3. 自定义识别/动作优先通过 Agent 进程实现；AgentServer 注册自定义逻辑后由 AgentClient 在运行时调用。
4. 监听回调时按 [2.3-回调协议.md](references/2.3-回调协议.md) 解析 message 与 details_json，注意线程安全与快速返回。
5. 需要控制器截图/输入方式配置时查阅 [2.4-控制方式说明.md](references/2.4-控制方式说明.md)。

## 常见陷阱

- 不要把 Pipeline JSON 当作完整 MFW 项目；项目还需要 `interface.json`、资源目录、可能的 Agent。
- `timeout` 作用于当前节点的 `next` 列表识别超时，而非当前节点自身的 recognition 等待时间。
- `roi`/`target` 的字符串引用支持节点名和 `[Anchor]锚点名`；引用为空时视为识别/动作失败。
- `default_pipeline.json` 在 Bundle 根目录与 `pipeline/` 同级，按 Bundle 加载顺序合并，已加载节点不受后续默认值影响。
- Pipeline 文件支持 JSONC，但能否使用以对应版本官方行为或明确工具契约为准；修改时避免破坏注释。
