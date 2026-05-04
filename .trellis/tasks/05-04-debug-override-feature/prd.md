# 调试模块 override 功能需求梳理

## Goal

为调试模块补上一个可手工编辑的运行时 `override` 能力，用来替代旧 Interface `option -> pipeline_override` 对调试的影响，让 MPE 在不读取 Interface 的前提下，仍可在调试时模拟某个 Interface 的覆盖配置。

## What I already know

- 用户希望在调试模块新增一个 `override` 模块，放在中控台 `当前 / 最新运行` 下方。
- 该模块默认收起，并内置 JSON 编辑器，方便直接编辑 override 内容。
- 本次只新增中控台这一个 override 模块，不再额外补独立的“用户 override”输入层。
- 该模块产出的 override 需要与调试运行基础 pipeline 合并后作为最终运行时 override 生效。
- 当前调试概览面板在 [src/features/debug/components/panels/OverviewPanel.tsx](D:\_Projects\maa-pipeline-editor\src\features\debug\components\panels\OverviewPanel.tsx) 中，`当前 / 最新运行` 已是独立 `DebugSection`。
- 调试区块组件 [src/features/debug/components/DebugSection.tsx](D:\_Projects\maa-pipeline-editor\src\features\debug\components\DebugSection.tsx) 已支持 `collapsible` 与 `defaultCollapsed`。
- 仓库已引入 Monaco（`@monaco-editor/react`），现有 [src/components/modals/NodeJsonEditorModal.tsx](D:\_Projects\maa-pipeline-editor\src\components\modals\NodeJsonEditorModal.tsx) 可复用其中的编辑器、格式化、语法校验思路。
- 当前 debug run 请求类型 [src/features/debug/types.ts](D:\_Projects\maa-pipeline-editor\src\features\debug\types.ts) 已有 `overrides?: DebugPipelineOverride[]` 字段。
- 当前 `buildRunRequest()` 会把 `buildDebugSnapshotBundle()` 里的 `bundle.overrides` 带入请求，见 [src/stores/debugRunProfileStore.ts](D:\_Projects\maa-pipeline-editor\src\stores\debugRunProfileStore.ts)。
- 但后端 [LocalBridge/internal/debug/runtime/runtime.go](D:\_Projects\maa-pipeline-editor\LocalBridge\internal\debug\runtime\runtime.go) 当前 `PipelineOverride(root, req)` 并未消费 `req.Overrides`，所以前端新增 UI 后还需要补全真正的合并/生效逻辑。
- 现有 `snapshot.ts` 中的 `bundle.overrides` 本质上是从导出的 pipeline 节点对象抽出的运行节点快照，而不是用户手填的附加 override 来源。

## Assumptions (temporary)

- 用户要的 JSON 内容应直接采用 MaaFW `pipeline_override` 兼容结构，即 `{ "<RuntimeName>": { ...partial node pipeline... } }`。
- override 仅作用于调试运行，不回写图节点、不改 JSON 源文件。
- override 编辑值需要本地持久化，否则用户每次打开调试面板都要重输，体验较差。
- 未指定展开态记忆行为时，默认只要求“首次渲染默认收起”；是否记忆上次展开态可作为实现时的次优先级细节处理。

## Requirements (evolving)

- 在调试中控台增加 `override` 区块，位置在 `当前 / 最新运行` 下方。
- 区块默认折叠。
- 区块内提供可编辑 JSON 的编辑器，至少支持语法校验与格式化。
- 调试启动时，把该区块内容合并到最终运行时 pipeline override。
- 合并语义为：基础 pipeline 在前，模块 override 在后覆盖同名节点/字段。
- override 解析/校验失败时，应在前端阻止启动并给出明确错误。
- 后端必须真正消费前端传入的 override，而不是仅保留类型字段。

## Acceptance Criteria (evolving)

- [ ] 中控台能看到默认折叠的 `override` 区块，位置在 `当前 / 最新运行` 下方。
- [ ] 用户可编辑合法 JSON，并可一键格式化。
- [ ] 非法 JSON 时，运行按钮启动被拦截，并看到明确报错。
- [ ] 最终调试请求会带上合并后的 override，且后端实际使用它启动运行。
- [ ] 当模块 override 命中基础 pipeline 的同一节点/字段时，以模块 override 的值为准。

## Out of Scope (explicit)

- 不恢复旧 Interface 导入/解析链路。
- 不把 override 持久写回 pipeline 文件或节点属性面板。
- 不在本任务中扩展 breakpoint / pause / continue 等其他调试设计。

## Technical Notes

- 现有 `OverviewPanel` 已适合放置一个新的 `DebugSection`。
- 现有 `DebugSection` 支持默认折叠，但不自带跨次持久化；若要记忆展开状态，需要额外接入 memory/profile store。
- 当前 debug-vNext 主链里没有已生效的“用户 override”输入源；代码层面只有 `graphSnapshot` 导出的 pipeline 与未消费的 `req.overrides` 字段。
- 本次实现可简化为单一来源合并：
  - 前端：`debugRunProfileStore.buildRunRequest()` 负责把中控台 override 序列化进请求。
  - 后端：`PipelineOverride(root, req)` 先拿基础 pipeline，再深合并请求内 override。
