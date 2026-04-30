# 修复调试性能摘要问题

## Goal

修复调试模块性能面板中性能摘要总耗时一直显示 `0ms` 的问题，并让性能产物点击后的 JSON 内容使用已有 JSON viewer 展示，而不是纯文本 `<pre>`。

## What I Already Know

- 用户反馈性能摘要总耗时一直是 `0ms`，怀疑没有计算。
- 用户希望性能产物点击后的 JSON 用库来展示，而不是纯文本。
- `LocalBridge/internal/debug/performance/service.go` 已有 `BuildSummary`，会从 trace 事件的 `StartedAt` / `CompletedAt` 计算 `DurationMs`。
- `LocalBridge/internal/debug/runner/runner.go` 当前在发出 completed/failed/stopped 终态事件之前调用 `storePerformanceSummary`，因此 summary 构建时还看不到终态事件，`CompletedAt` 为空，`DurationMs` 会是 `0`。
- `src/features/debug/components/panels/PerformancePanel.tsx` 当前对 `selectedArtifact.payload.data` 使用 `<pre>{JSON.stringify(...)}</pre>` 展示。
- 仓库已有 `src/features/debug/components/DebugJsonPreview.tsx`，内部使用 `@microlink/react-json-view`；也已有 `DebugArtifactPreview`，可按 artifact payload 统一选择 JSON / image / text 预览方式。

## Requirements

- 普通运行、停止运行、失败运行结束后，生成的 `performance-summary` 产物应包含可用的终态时间，并让 `durationMs` 不再因为缺少终态事件而固定为 `0`。
- 性能摘要面板顶部的“耗时”继续读取 `performanceSummary.durationMs`，但后端需要保证该字段在有起止时间时被正确填充。
- 点击性能产物或批量产物后，性能面板内的 JSON 预览应复用现有 JSON viewer/产物预览组件，不再手写纯文本 JSON `<pre>`。
- 保留现有性能产物、批量识别摘要产物的自动加载与按钮入口。
- 不改变 DebugModal 面板分类、节点执行面板、trace replay、断点/暂停等既有设计边界。

## Acceptance Criteria

- [ ] 完成一次成功运行后，`performance-summary.durationMs` 基于运行起止时间计算，不再因为 summary 生成早于终态事件而固定为 `0`。
- [ ] 停止或失败运行时也能生成带终态状态和耗时的 `performance-summary`。
- [ ] 性能面板选择 JSON 类产物时，展示为可折叠的 JSON viewer，而不是纯文本 JSON。
- [ ] 若产物还在加载、加载失败或没有可预览内容，继续沿用现有产物预览状态展示。
- [ ] 不新增 dev server、浏览器测试或自动生成额外测试脚本。

## Out of Scope

- 不调整性能摘要字段模型或协议版本。
- 不重做性能面板整体 UI。
- 不引入新的 JSON viewer 依赖。
- 不改变批量识别摘要本身的统计口径。

## Technical Notes

- Likely backend files:
  - `LocalBridge/internal/debug/runner/runner.go`
  - `LocalBridge/internal/debug/performance/service.go`
- Likely frontend files:
  - `src/features/debug/components/panels/PerformancePanel.tsx`
  - `src/features/debug/components/DebugArtifactPreview.tsx`
  - `src/features/debug/components/DebugJsonPreview.tsx`
- Existing listener flow:
  - `registerProtocolListeners.ts` auto-loads `performance-summary` and `batch-recognition-summary` artifacts.
  - Loaded `performance-summary` payload updates `debugTraceStore.performanceSummary`.
- Validation should stay narrow per project guidance: targeted syntax/lint checks only where practical, plus `git diff --check`.
