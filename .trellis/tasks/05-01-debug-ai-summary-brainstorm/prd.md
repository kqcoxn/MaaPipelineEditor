# brainstorm: 调试模块 AI 总结

## Goal

为 MaaPipelineEditor 调试工作台增加 AI 总结能力：将当前调试输出数据整理为适合大模型消费的上下文，复用现有 AI 基础模块生成可读、可定位、可复查的调试报告，帮助用户更快理解失败原因、异常节点、识别/动作问题与下一步排查方向。

## What I already know

* 用户希望先列功能候选，不进入实现。
* 调试模块当前以 DebugModal 为核心，不存在全局调试开关或断点/继续语义。
* 当前调试输出主要来自 session/run 状态、trace events、artifact refs/payloads、diagnostics、performance summary、node execution records、images/screenshot、maa.log。
* 当前协议版本为 debug-vNext / 0.18.0，事件类型包括 session、task、node、next-list、recognition、action、wait-freezes、screenshot、diagnostic、artifact、log。
* 当前前端已有节点执行、时间线、性能、图片、诊断等面板，AI 总结可以作为新面板、现有面板动作，或报告导出能力接入。
* 用户已确认基础功能中除“慢节点/性能瓶颈总结”外都需要做。
* 用户已确认扩展功能暂时都不做。
* 用户已确认报告需要两份：详细报告放在专门 Tab，简单摘要放在中控台下面并可点击跳转到详细报告。
* 用户已确认调试设置里需要单独增加“是否自动生成 AI 总结”，默认关闭。
* AI 基础能力应复用当前 `src/utils/ai/` 模块，包括 `AIClient`、Provider 抽象、用户已有 AI 配置、LocalBridge 代理能力与现有错误处理。

## Assumptions (temporary)

* 第一阶段只使用当前会话/当前运行可访问的数据，不做长期 MPE 调试历史库。
* AI 总结不应替代现有原始 trace/artifact 展示，而应提供可追溯的摘要与定位入口。
* 需要避免把超大图片/base64 原文、敏感路径或无关日志直接喂给模型。

## Open Questions

* 自动生成触发时机是否仅限运行结束后，还是失败时提前生成失败摘要？当前默认按运行结束后触发设计。

## Requirements (evolving)

### Confirmed Scope

* 复用现有 AI 基础模块：不为调试功能另起一套 Provider/API Key/代理配置。
* 当前 Run 调试报告：用户可对当前调试会话/运行生成一份中文报告。
* 双层报告：同一次 AI 总结应产出一份详细报告和一份简单摘要。
* 失败原因摘要：AI 应从 failed 事件、diagnostics、失败节点执行记录、相关 artifact 摘要中提炼最可能原因，并按证据强度组织。
* 节点级 AI 解释：用户可对单个节点执行记录生成解释，覆盖 recognition、action、next-list、wait-freezes 等当前已有事件/详情。
* 证据引用与定位：报告结论应引用节点、事件 seq、诊断、artifact ref 等可追溯证据，并能回到对应调试视图。
* 模型输入预处理：输入给模型前应做结构化裁剪、脱敏、去重和 token 预算控制。
* 报告重新生成：允许用户围绕同一 Run 重新生成报告，至少支持“完整报告 / 只看失败 / 只看节点”一类的不同关注点。
* 复制 Prompt / 复制报告：允许复制最终报告，也允许复制整理后的 Prompt/上下文，便于用户外部复查。
* 失败兜底：AI 配置缺失、请求失败、超时、模型返回空内容时，应展示明确错误，不影响原有调试流程。

### Report Content

* 报告应包含：整体结论、运行概况、失败/异常节点、关键证据、建议下一步。
* 报告应避免泛泛建议，必须尽量绑定具体节点、事件或 artifact。
* 报告中不做慢节点/性能瓶颈专项总结；性能数据可作为辅助背景，但不是本期主功能。
* 详细报告：放在专门的 `AI 总结` Tab 内，承载完整结构化报告、证据引用、复制报告/Prompt、重新生成入口、错误状态。
* 简单摘要：放在 `中控台` 下方，展示最短可扫读结论，例如“状态 / 最可能原因 / 关键节点 / 下一步”，并提供跳转到 `AI 总结` Tab 的入口。
* 简单摘要不重复承载完整报告内容；它是中控台的状态提示与导航入口。

### AI Context Construction

* 输入模型的数据应优先使用结构化摘要，而不是原始大 JSON 直接拼接。
* artifact 只传递必要的文本/JSON 摘要、类型、ref、事件来源，不直接传递大体积 base64 图片内容。
* 路径、设备标识、API Key、用户环境等潜在敏感内容需要裁剪或脱敏。
* 上下文应保留可定位字段：runId、sessionId、event seq、nodeId、runtimeName、displayName、diagnostic code、artifact id。

### UI/Interaction

* AI 总结能力属于 DebugModal，不进入节点字段/property 面板。
* DebugModal 左侧导航新增专门的 `AI 总结` Tab，用于展示详细报告。
* `中控台` 面板下方新增简单摘要区域：无报告时显示未生成/可生成状态；有报告时显示摘要并支持点击跳转到 `AI 总结` Tab。
* `运行配置`/调试设置中新增“自动生成 AI 总结”开关，默认关闭，使用本地调试设置记忆。
* 自动生成开启后，当前运行结束并具备足够调试输出时自动触发一次 AI 总结；关闭时仅手动生成。
* 自动生成不应阻塞调试运行完成态，也不应影响 trace/artifact/diagnostics 入库。
* 生成中、成功、失败、空数据、配置缺失都需要有明确状态。
* 报告不作为长期调试历史默认持久化；如果需要保留，只允许用户复制/导出。
* AI 报告不改变原始 trace、artifact、diagnostics 数据，不反向写入调试状态。

## Acceptance Criteria (evolving)

* [ ] 用户可以对当前调试会话/运行生成一份中文调试报告。
* [ ] 详细报告展示在专门的 `AI 总结` Tab 中。
* [ ] 中控台下方展示简单摘要，并可跳转到 `AI 总结` Tab。
* [ ] 运行配置中存在“自动生成 AI 总结”开关，默认关闭。
* [ ] 开启自动生成后，运行结束会自动生成一次报告；关闭时不会自动请求 AI。
* [ ] 用户可以对失败节点或指定节点生成节点级解释。
* [ ] 报告能引用至少一种可追溯证据：节点、事件 seq、诊断或 artifact。
* [ ] 报告能提供失败原因摘要和下一步排查建议。
* [ ] 用户可以复制报告和整理后的 Prompt/上下文。
* [ ] 模型输入不直接包含大体积 base64 图片内容。
* [ ] AI 调用复用现有 `AIClient` / Provider 配置 / LocalBridge 代理能力。
* [ ] 失败时能展示明确错误，不影响原有调试流程。

## Definition of Done (team quality bar)

* Tests added/updated when implementation begins.
* Targeted lint or syntax checks run for touched files.
* PRD/docs updated if behavior changes.
* Cost, privacy, timeout, and fallback behavior considered.

## Out of Scope (explicit)

* 本轮不实现代码。
* 不引入断点/继续/单步调试语义。
* 不把 AI 报告作为长期调试历史默认持久化。
* 不做慢节点/性能瓶颈专项总结。
* 不做扩展功能：图谱路径解释、多 Run 对比、图片/识别结果视觉问诊、最小复现包说明、maa.log 深度解读、AI 排障 Checklist、报告质量评分、Debug Copilot 问答、自动生成修复建议 Diff、团队分享报告模板。
* 不新增独立 AI Provider 配置体系。

## Technical Notes

* Relevant frontend files inspected: `src/features/debug/types.ts`, `src/features/debug/components/panels/OverviewPanel.tsx`, `src/features/debug/components/panels/DiagnosticsPanel.tsx`, `src/features/debug/components/panels/PerformancePanel.tsx`, `src/features/debug/artifactDetailSummary.ts`.
* Relevant backend contract inspected: `LocalBridge/internal/debug/protocol/types.go`.
* Existing panel IDs in active types: `overview`, `setup`, `timeline`, `node-execution`, `performance`, `images`, `diagnostics`.
* Existing AI foundation inspected: `src/utils/ai/aiClient.ts`, `src/utils/ai/providers/types.ts`, `src/services/protocols/AIProtocol.ts`, `src/utils/ai/history.ts`.
* Current AI foundation already supports configured provider type/model/API URL/API key, direct fetch or LocalBridge proxy, non-stream and stream proxy paths, estimated token usage, and global AI history recording.

## Implementation Record

### 2026-05-01 完成记录

* 新增 `AI 总结` DebugModal Tab，用于生成和查看详细报告、简单摘要、Prompt 与整理后的上下文。
* 中控台新增 `AI 简要摘要` 区域：有报告时展示短摘要并可跳转详细报告；无报告时提供手动生成入口。
* 运行配置新增“运行结束后自动生成 AI 总结”开关，默认关闭，写入调试本地记忆。
* AI 调用复用现有 `AIClient`，不新增 Provider/API Key/代理配置。
* 新增调试上下文构建与脱敏裁剪逻辑：保留 session/run、event seq、node、diagnostic、artifact ref 等证据字段；图片/base64 只记录省略标记。
* 支持完整报告、只看失败、节点解释三种生成入口。
* AI 报告状态仅保存在当前前端调试状态中；启动新调试运行时清空，不做长期 MPE 调试历史。
* 验证：触达文件 `yarn eslint` 通过；`git diff --check` 通过；全量 `tsc -p tsconfig.app.json --noEmit` 仍被仓库既有 baseline 错误阻塞，输出未指向本次新增 AI 总结文件。

### 2026-05-01 调整记录

* `AI 总结` Tab 调整到 `事件线` 之后，保持调试阅读顺序先看事件再看 AI 报告。
* `AI 总结` 面板首行收窄节点选择框，并与生成按钮放在同一行，避免“解释节点”按钮被长节点名挤出可见区域。
* 详细报告按 Markdown 内容处理，使用 `react-markdown` 渲染，不再以纯文本块展示。
* 中控台仅在已有可选/展示会话后显示 `AI 简要摘要` 区域；第一次运行前不展示该子模块。
* 验证：实现代理与检查代理均完成；触达文件 `yarn eslint` 通过；全量 typecheck 仍受仓库既有 baseline 错误阻塞，未指向本次调整文件。
