# MPE Harness PI 辅助：实现与验收

## 能力与边界

项目对话复用原画布工具，增加两个内置 Skill 和九个 PI 工具。默认包含草稿；写入仅进入已有 PI 编辑器的关联草稿与撤销历史。第三、第四阶段保持取消，不提供独立预览画布、框架最终值、Agent／设备执行或跨 PI／Pipeline 保存事务。

Skill 分为 `maafw-project-interface` 协议指南和 `mpe-pi-editing` 操作工作流。工具为 `read_pi_summary`、`read_pi_definitions`、`find_pi_references`、`read_project_pipeline_nodes`、`resolve_pi_configuration`、`read_mfw_pi_reference`、`preview_pi_changes`、`apply_pi_changes`、`validate_pi`。

## 模块与契约

- `ai-harness/capabilities/project-interface` 拆分上下文、查询、引用投影、脱敏、局部修改、方案命令、工具及结果展示；`skills/project-interface` 提供协议与工作流。工作区上下文和分域校验位于 composition 层。
- LocalBridge 的 `/etl/interface/harness/query` 与 `/etl/interface/harness/resolve` 通过 `/lte/interface/harness/result` 关联请求 ID。响应提供源文件版本、定义、引用、原始节点、诊断及覆盖事件；不会登记运行上下文。草稿快照复用 PI 编辑器的原文与导入合并结果。
- 覆盖来源通过生产选项解析器的可选观察器记录；关闭观察器时保持原运行语义。事件保留原始输入、求值结果、适用性与源位置，多选按定义顺序应用，预任务不进入 Pipeline 覆盖。
- PI 方案使用查询返回的 `stateVersion` 作为 `expectedPiVersion`，使用 `versions` 作为 `expectedVersions`。方案绑定 Run、项目、草稿及依赖文件版本；应用前重新读取并校验，方案应用后立即失效。
- 方案仅在内存生成差异，检查新增错误后一次加入关联草稿。目标文档尚未打开时，同步加载基线后提交，不切换页面。来源变更保留草稿，保存继续使用第二阶段的事务和冲突检查。
- 画布与 PI 分别校验和撤销；部分成功明确标为部分完成。连接、项目和配置变化使旧分析请求失效。模型上下文和工具历史中的密码输入脱敏。
- 查询采用按请求构建快照，避免保留跨文件的过期结果缓存；变更方案只存内存，并在 Run 结束后释放。

协议参考：本地 MaaFramework `b8492836568adaabec434199405083ff29c47413`；AI 选项工作流参考 MaaGumballs `7aee0e90d81cba000fdb57463f219ccfa96a0420`。协议语义以 MaaFramework 为准。

## 自动验证

自动检查结果：

- LocalBridge `go test ./...` 通过；后续来源记录修正后的 PI 服务与 Interface 运行相关测试通过。
- Vitest 全量 182 个文件、791 项测试通过。引用分支判断的最终局部调整另行回归通过。
- TypeScript 编译器对比 HEAD 基线：原有 668 项诊断，当前 668 项，新增 0 项；不将其表述为全项目类型检查无错误。
- 改动范围 ESLint（`--max-warnings=0`）与 antd lint 通过。
- Editor 构建通过，存在包体积与既有动态／静态导入分块提示。
- `git diff --check` 通过。未启动开发服务器或浏览器测试。

## 人工验收清单

- 从 Interface 和 PI 编辑器点击“AI 辅助”；确认仍是原会话，显示当前任务和数据源。
- 查询任务、共享选项及嵌套引用，展开源码来源；确认跳转文件与字段正确。
- 切换草稿／磁盘模式，修改尚未保存的 PI 和有路径的 Pipeline；确认查询值随模式变化，无路径画布不被归入资源。
- 指定任务、资源与控制器，询问覆盖原因；核对多选顺序、未适用原因和输入表达式，确认没有声称实际执行结果。
- 从当前节点出发，增加 PI 输入项与任务引用；查看差异，再在 PI 编辑器撤销、重做和保存。
- 修改共享选项、跨 PI 文件改名；核对引用更新和同名歧义提示。先解除引用后删除，确认不会留下明确悬空引用。
- 生成方案后手动修改草稿或磁盘文件；确认旧方案拒绝应用且原草稿保留。
- 请求期间停止、断线、切换项目或配置；确认旧回复不修改新项目。
- 回归画布 AI 编辑、AI 重排、流程架构，以及 Interface 原有运行与冻结配置；检查部分成功状态。

人工验收由用户执行，自动测试不替代上述交互确认。
