# 修复调试模块保存模式文件版本串用问题

## Goal

修复调试模块在多次运行、多个本地文件同时打开时可能读取到错误文件版本的问题，确保用户在当前文件发起调试时，实际使用的入口与 pipeline 内容稳定对应当前文件与当前保存策略，并把默认策略恢复到预期的沙盒模式。

## What I already know

* 用户反馈在运行 `shop` 对应 json 时，实际执行成了 `start` 的内容；重新从本地文件重新打开两个窗口后恢复正常。
* 用户看到当时是“保存打开文件”模式，且没有主动切换过；理论预期默认应为沙盒模式。
* `src/stores/debugRunProfileStore.ts` 当前默认 `savePolicy` 不是固定 `sandbox`，而是由 `useConfigStore.getState().configs.saveFilesBeforeDebug` 推导；当该配置为 `true` 时默认会落到 `save-open-files`。
* `src/stores/configStore.ts` 当前 `saveFilesBeforeDebug` 默认值为 `true`。
* 前端调试请求会携带 `savePolicy`，但后端 `LocalBridge/internal/debug` 中除了请求校验外，尚未发现按 `savePolicy` 分流运行内容的实现。
* `src/features/debug/snapshot.ts` 的 `buildDebugSnapshotBundle()` 会把所有已打开文件的 pipeline 快照一起打包进 `graphSnapshot.files`，而后端 `LocalBridge/internal/debug/runtime/runtime.go` 的 `PipelineOverride(req)` 会把这些文件按 `runtimeName` 扁平覆盖到同一个 override map 中。
* 该实现对“多文件同时打开”“文件间 runtimeName 冲突”“非当前文件缓存落后于磁盘或当前 flow”都较为敏感，可能导致当前文件调试被其他打开文件污染。

## Requirements

* 调试默认保存策略应回到 `sandbox`，不能再因为旧的全局配置默认值而默认落到 `save-open-files`。
* 调试启动必须真正遵守 `savePolicy` 语义，不能只在 UI 和请求校验层面存在。
* 当前文件发起调试时，运行内容不能再被其他已打开文件的旧快照或无关 pipeline 覆盖。
* 修复后，用户无需通过“重开文件 / 重开调试模块 / 刷新 MPE”来拿到最新文件版本。
* 保持现有 DebugModal / 节点右键调试入口可用，不引入旧版兼容层。

## Acceptance Criteria

* [ ] 新建或重置调试配置时，保存策略默认显示为 `sandbox`。
* [ ] `save-open-files`、`sandbox`、`use-disk` 在前后端均有可解释且实际生效的行为，不再是名义选项。
* [ ] 同时打开多个本地文件时，从当前文件发起调试不会误跑到其他文件的 pipeline 内容。
* [ ] 静态检查能够证明后端不再无条件忽略 `savePolicy`。
* [ ] 语法 / lint / 相关静态验证通过，且明确说明实际执行过哪些验证。

## Definition of Done

* 修复代码完成并自测核心链路
* 相关前后端文件通过针对性 lint / 语法检查
* 任务文档记录本次根因与修复范围

## Technical Approach

* 先修正前端默认值与调试 profile 归一化逻辑，保证新配置默认回到 `sandbox`。
* 梳理调试请求中的快照来源与后端 override 组装方式，按 `savePolicy` 区分使用当前内存快照、已保存打开文件、或磁盘文件。
* 收紧当前文件调试所使用的 pipeline 集合，避免无关打开文件直接进入 runtime override。

## Out of Scope

* 不改调试运行模式（`run-from-node` / `single-node-run` / `recognition-only` / `action-only`）的产品定义。
* 不做 docsite 文档改写，除非修复过程发现必须同步的实现记录。
* 不做浏览器联调或 `yarn dev` 验证。

## Technical Notes

* 重点文件：
  * `src/stores/debugRunProfileStore.ts`
  * `src/stores/configStore.ts`
  * `src/features/debug/snapshot.ts`
  * `src/features/debug/hooks/useDebugModalController.ts`
  * `LocalBridge/internal/debug/runtime/runtime.go`
  * `LocalBridge/internal/debug/protocol/types.go`
* 当前可疑症状更像“默认值漂移 + savePolicy 未生效 + 多打开文件快照污染”的组合问题，而不是单一 UI 文案问题。
