# ResourceHealthPanel 加载失败诊断顺序复核

## Goal

仅针对 `ResourceHealthPanel` 前端渲染逻辑做快速复核与必要修复，确认资源加载失败时：

1. 具体失败线索不会被泛化的 `resourceHealthError` / summary 文案掩盖。
2. checklist 里的具体原因优先于通用 `load_failed` / `load_skipped` / `load_unavailable` 信息展示。
3. 用户可见标签与说明文案使用“资源加载”等产品语言，不暴露 `resolver` 或其他实现导向措辞。

## Scope

* 只看 `src/features/debug/components/panels/ResourceHealthPanel.tsx` 及其直接依赖的前端分类/排序 helper。
* 只验证面板渲染逻辑、分组排序语义、顶部 summary 描述逻辑与文案层级。
* 若发现明确问题，直接修复并做 targeted validation。

## Out of Scope

* 不改后端诊断生成规则。
* 不改 DebugModal 其他面板。
* 不扩展新的诊断协议字段。

## Acceptance

* 加载失败时，summary 优先暴露具体 checklist 原因或线索，而不是只停留在泛化失败文案。
* `loading` 分组内，具体 checklist 项排在泛化 `load_failed` / `load_skipped` / `load_unavailable` / `ready` 之前。
* 面板可见标签统一使用产品语言，例如“资源加载”“MPE已加载文件”“节点映射/连线映射”，不再展示 `resolver` 或其他实现导向说明。
* targeted lint / type-check 对涉及文件通过。
