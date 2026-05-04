# Resource Bundle Intelligent Resolver

## Goal

为 LocalBridge 增加一个统一的资源路径智能解析能力，把用户输入的“项目根目录 / bundle 子目录 / pipeline 目录 / pipeline 文件路径”等非标准资源路径，归一化为 MaaFramework 可直接 `PostBundle` 的资源根目录，减少资源路径配置成本，并让预检、实际运行、Agent 绑定等入口行为一致。

## What I already know

- MaaFW 资源目录的稳定锚点是资源根目录下的 `pipeline/`；`image/`、`model/ocr/` 也位于同一资源根目录下。
- 当前后端资源预检直接对传入路径做 `PostBundle(...).Wait()`，不会先做 bundle 根目录归一化。
- 当前 debug 运行时、Agent 资源绑定、通用资源加载都直接消费 `resourcePaths`，缺少统一的智能解析层。
- 当前静态诊断只检查路径存在、是否为目录，以及是否存在 `pipeline/image/model/default_pipeline.json` 任一 marker；这不足以处理“给到子目录或上层目录”的情况。
- 当前资源扫描服务会识别 bundle，但它的职责偏向“扫描并推送列表”，并不等于统一资源路径解析。

## Assumptions (temporary)

- 首版智能解析能力应落在 LocalBridge 后端，而不是前端表单层。
- 首版以“资源 bundle 根目录解析”作为核心能力，不同时引入复杂的 pipeline 内容分析。
- `model/ocr` 缺失不应直接判定路径非法；它更适合作为增强诊断，而不是 bundle 合法性的硬门槛。
- 本任务按首版 MVP 推进：先覆盖“会实际加载资源”的链路，不在本阶段重写资源扫描服务的 bundle 发现逻辑。

## Open Questions

- 暂无阻塞性开放问题；若实现时发现资源扫描服务必须共享 resolver 才能保持一致，再回滚补充二期范围说明。

## Requirements (evolving)

- 提供统一的资源路径解析模块，输入用户给定路径，输出标准 bundle 根目录或歧义/失败诊断。
- 支持精确命中：目录本身含 `pipeline/` 时直接识别为 bundle 根目录。
- 支持向上检索：当输入路径位于 `pipeline/`、`pipeline/*.json`、`image/**`、`model/**`、`model/ocr/**` 下时，回溯到最近的 bundle 根目录。
- 支持有限向下检索：当输入路径是项目根目录或工作区根目录时，搜索子目录中的 bundle 候选。
- 向下检索仅在候选唯一时自动采用；多个候选时返回歧义诊断，不静默猜测。
- 调试资源预检与实际资源加载必须共用同一解析逻辑，避免 preflight 与 runtime 行为分叉。
- Agent 资源绑定所使用的资源路径也必须走同一解析逻辑。
- 通用 `load resource` 入口也必须走同一解析逻辑。
- 诊断结果需要能向上层解释“使用了哪种解析策略 / 命中了哪个目录 / 为什么失败或歧义”。
- 首版接入范围仅包括：
  - debug resource preflight
  - debug runtime resource load
  - debug agent resource bind
  - 通用 MFW `load resource`
- 资源扫描服务在首版保持现状，但新 resolver 设计需允许二期复用到扫描/发现逻辑。

## Acceptance Criteria (evolving)

- [ ] 给定 bundle 根目录时，预检与实际加载行为保持成功且无行为回退。
- [ ] 给定 `pipeline` 目录或 `pipeline/*.json` 文件路径时，能够自动解析到 bundle 根目录。
- [ ] 给定 bundle 内部 `image/**` 或 `model/ocr/**` 路径时，能够自动解析到 bundle 根目录。
- [ ] 给定项目根目录且仅存在一个候选 bundle 时，能够自动解析到该 bundle 根目录。
- [ ] 给定项目根目录且存在多个候选 bundle 时，不自动猜测，并返回可读的歧义诊断。
- [ ] debug preflight、debug runtime、agent resource bind、通用 `load resource` 的解析结果一致。
- [ ] 首版改动不要求同步改变资源扫描服务的 bundle 发现结果。

## Definition of Done

- 资源路径解析规则在任务 PRD 中明确。
- 实现与首批接入入口完成。
- 至少完成语法/静态验证，并明确记录实际验证范围。
- 若行为或约束发生变化，补充必要文档/规格更新。

## Out of Scope (explicit)

- 不在首版中做 pipeline JSON 内容级别分析来反推是否一定需要 OCR。
- 不在首版中改造 MaaFW 本身的资源加载语义。
- 不在首版中做浏览器自动化验证。
- 不在首版中设计新的复杂资源选择 UI。
- 不在首版中重写 `LocalBridge/internal/service/resource/resource_service.go` 的扫描深度或扫描规则。

## Technical Notes

- 现有 debug preflight 入口：`LocalBridge/internal/debug/api/handler.go`
- 现有资源运行时加载：`LocalBridge/internal/mfw/adapter.go`
- 现有 Agent 绑定加载：`LocalBridge/internal/debug/runtime/agent_pool.go`
- 现有 debug runtime resourcePaths 入口：`LocalBridge/internal/debug/runtime/runtime.go`
- 现有静态资源诊断：`LocalBridge/internal/debug/diagnostics/service.go`
- 现有资源扫描服务：`LocalBridge/internal/service/resource/resource_service.go`
