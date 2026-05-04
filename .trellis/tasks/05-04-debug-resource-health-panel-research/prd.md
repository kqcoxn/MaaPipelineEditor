# 调试模块资源体检面板调研

## Goal

为 MPE 的 DebugModal 设计一个独立的“资源体检”面板，用于在正式调试前判断当前资源配置与当前图快照是否合规。该面板需要结合 MSE 的校验思路，但保持 MPE 现有的 graph-first、DebugModal 内聚、非 VS Code/非 interface.json 驱动的产品模型。

## What I already know

* 用户希望在调试模块增加“资源体检”面板，重点是测试资源是否合规，包括整体能否被加载、pipeline 是否合法。
* MPE 当前已经有真实资源加载预检链路：前端通过 `/mpe/debug/resource/preflight` 请求，后端会解析资源路径并调用 MaaFramework 真实执行 `PostBundle` 加载检查。
* MPE 当前已经有一套调试诊断基础设施：`DebugDiagnostic`、诊断 store、`DiagnosticsPanel`、调试前置条件检查、运行前 request 校验。
* MSE 的相关能力不是单一按钮，而是至少分成三层：静态诊断、原生资源加载验证、识别测试。
* 用户此前明确要求：参考 MSE 只能借鉴思路，不能照搬 UI、术语或交互。

## Research References

* [`research/mse-resource-health-panel.md`](research/mse-resource-health-panel.md) — MSE 的 `runCheck` / `runTest` 能力拆分、适合借鉴的点与不适合照搬的点。
* [`research/mpe-resource-health-baseline.md`](research/mpe-resource-health-baseline.md) — MPE 现有资源预检、诊断与图校验基础，以及资源体检面板可复用的实现抓手。

## Requirements (evolving)

* 在 DebugModal 中提供一个独立的“资源体检”面板，而不是继续把所有结果混在“诊断”页里。
* 体检结果应围绕“当前调试配置 + 当前图快照”展开，而不是面向外部工作区/VS Code 工程做泛化扫描。
* 体检至少覆盖两层：
  * 资源路径是否能解析到 bundle 根目录，并被 MaaFramework 成功加载。
  * 当前图导出的 pipeline / resolver / target 是否满足调试运行前的基本合法性约束。
* 若做更深一层，优先补“静态语义检查”，例如缺失节点、非法引用、重复/冲突资源路径、目标节点不在 resolver 中、图为空等。
* 结果展示应可读、可分组，并能指向资源路径、文件或节点，而不是只给一串错误文本。
* 新面板需要复用当前的 `DebugDiagnostic` 结构和 LocalBridge debug-vNext 协议能力，避免再造一套平行的诊断模型。
* 本任务采用中等方案：首期资源体检聚焦“资源路径解析 + MaaFW 真实加载 + 当前图静态调试合法性”，不纳入样例图识别回归测试。
* 首期允许提供少量快捷操作，如“重新体检”“跳到调试配置”“定位到节点/文件”。
* 首期不提供自动修复能力，但每条重要诊断应给出明确修复建议。

## Acceptance Criteria (evolving)

* [ ] 用户可以在 DebugModal 内单独打开“资源体检”面板查看结果。
* [ ] 体检结果至少区分“资源解析/加载”和“图/运行前约束”两类问题。
* [ ] 当资源路径无法解析、存在歧义或 MaaFW 无法加载时，能展示明确原因与对应路径。
* [ ] 当当前图快照缺少运行所需关键信息时，能展示明确的错误或警告，并关联到 fileId / nodeId / sourcePath。
* [ ] 结果展示不复刻 MSE 的 VS Code Problems 或 interface.json 术语，而是使用 MPE 调试语境。
* [ ] 关键错误项会附带用户可执行的修复建议，但不会提供自动修复按钮。

## Feasible Approaches

### Approach A: 轻量方案

只把现有“资源加载检测”从 Setup/Diagnostics 中抽出来，再补少量前端/后端已有的运行前校验。

* 优点：成本低，能快速上线。
* 缺点：更像“资源预检升级版”，离“体检”仍偏窄，缺少静态语义检查。

### Approach B: 中等方案（Recommended）

新增独立“资源体检”面板，统一展示三组结果：

* 资源路径解析
* MaaFW 真实加载
* 当前图静态调试合法性检查

该方案优先复用现有 `resource/preflight`、`validateRunRequest`、`diagnostics.Service.CheckRun` 和资源解析诊断，再补一层“面向当前图快照”的静态检查。

* 优点：和 MSE 的思路接近，但仍然贴合 MPE 当前调试模型；信息密度和实现成本平衡较好。
* 缺点：需要新增一个更完整的 backend check route，不能只靠现有 preflight 结果拼出来。

### Approach C: 重方案

在 Approach B 基础上，再加入类似 MSE `runTest` 的“样例图识别回归测试”。

* 优点：能力最完整，能验证识别正确性而不只是合法性。
* 缺点：超出“资源体检”首期范围，需要测试数据组织、批量任务调度、结果基线管理，复杂度明显上升。

## Technical Approach

推荐先按 Approach B 收敛：

* 前端新增独立面板“资源体检”，保留现有“诊断”页继续承接 run 期问题。
* 后端新增面向 DebugModal 的综合检查路由，而不是把所有逻辑塞进 `/mpe/debug/resource/preflight`。
* 结果协议继续使用 `DebugDiagnostic`，并按 category/source 分组展示，避免前后端出现第二套诊断数据模型。
* 静态检查聚焦“当前调试上下文”：
  * 当前 profile 资源路径
  * 当前 graph snapshot / resolver snapshot
  * 当前可选 target
* 首期不做识别回归测试、不做 MSE interface.json 级配置检查、不做 CI 集成。

## Decision (ADR-lite)

**Context**: 用户要的是 DebugModal 内的资源合规体检，而不是 VS Code 风格的全工程诊断工具。MPE 已有真实资源预检和调试诊断基础，但缺少一个集中、分层、面向当前调试上下文的体检视图。

**Decision**: 已选择中等方案，做独立“资源体检”面板，覆盖资源解析、真实加载、图静态合法性三层，不纳入识别样例回归测试；首期允许少量快捷操作与修复建议，但不做自动修复。

**Consequences**:

* 需要新增综合检查协议与面板，但大部分底层能力可复用。
* 产品形态更贴近 MPE 调试工作流，不会把 MSE 的工程化/CI 化能力硬塞进 DebugModal。
* 若后续用户确实需要“识别准确率回归”，可以在此基础上扩展为第二阶段，而不是首期一口气做全。

## Out of Scope

* 直接照搬 MSE 的 Launch/Problems/UI 术语与交互。
* 在首期引入断点、暂停、继续、单步等运行控制。
* 在首期引入基于样例图数据集的批量识别回归测试。
* 面向 VS Code workspace / interface.json / 多 layer 工程的全量诊断。
* CI / GitHub Actions 集成。
* 自动修复或一键修改资源/图配置。

## Technical Notes

* 现有资源预检前端入口：
  * `src/features/debug/hooks/useDebugModalController.ts`
  * `src/features/debug/components/panels/SetupPanel.tsx`
  * `src/services/protocols/DebugProtocolClient.ts`
  * `src/stores/debugSessionStore.ts`
* 现有后端资源预检与诊断：
  * `LocalBridge/internal/debug/api/handler.go`
  * `LocalBridge/internal/mfw/resource_bundle_resolver.go`
  * `LocalBridge/internal/debug/diagnostics/service.go`
  * `LocalBridge/internal/debug/diagnostics/resource_diagnostics.go`
* 现有前端图/运行前校验：
  * `src/features/debug/modalUtils.ts`
  * `src/utils/node/nodeJsonValidator.ts`
  * `src/stores/flow/slices/edgeSlice.ts`
  * `src/core/parser/importer.ts`
