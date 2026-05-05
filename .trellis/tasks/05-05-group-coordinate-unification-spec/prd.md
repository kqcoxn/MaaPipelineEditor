# Group Coordinate Unification Spec

## Goal

收敛 MaaPipelineEditor 分组（Group）相关的坐标语义，消除“节点在组内时定位、保存、粘贴、分组变更出现坐标错乱”的系统性问题。最终约束是：业务层与持久化层统一以绝对坐标作为真实值，React Flow 的父子相对坐标只保留在渲染适配边界。

## What I already know

* React Flow `parentId` 子节点的 `position` 语义是“相对父节点定位”；`{ x: 0, y: 0 }` 表示父节点左上角。来源：`dev/instructions/react-flow/learn/layouting/sub-flows.mdx`
* 当前仓库里 Group 相关逻辑大量直接使用 `node.position +/- parent.position` 手写换算，散落在 store slice、parser、组件定位入口中。
* `src/stores/flow/utils/nodeUtils.ts` 中已有 `getNodeAbsolutePosition()`，但当前实现只处理一层父节点，无法作为统一真值入口。
* `src/stores/flow/slices/nodeSlice.ts` 中 `groupSelectedNodes()`、`ungroupNodes()`、`attachNodeToGroup()`、`detachNodeFromGroup()` 都在直接做相对/绝对转换。
* `src/stores/flow/slices/graphSlice.ts` 中 `paste()` 同时承担复制后坐标偏移、父子关系恢复、组命中检测、相对坐标回写，坐标职责耦合严重。
* `src/core/parser/importer.ts` 当前导入后恢复 `parentId`，但不区分文件中的子节点位置是“旧相对坐标”还是“新绝对坐标”。
* `src/core/parser/nodeParser.ts` 当前导出直接把 `fNode.position` 落盘；对组内子节点而言，这意味着持久化层已经混入相对坐标。

## Assumptions (temporary)

* 本次先产出可落地 spec，不直接进入实现。
* Group UI 交互仍继续使用 React Flow 原生 `parentId` 机制，不改成完全自绘容器。
* 现有文件格式可以接受增加一个坐标模式标记，以支持旧数据兼容导入与新数据绝对坐标导出。

## Open Questions

* 暂无阻塞性问题；当前信息足以先固定 spec。

## Requirements (evolving)

* 领域层、状态层、定位逻辑必须统一使用绝对坐标作为真实值。
* React Flow 适配层是唯一允许处理 `parentId + relative position` 的边界。
* 所有定位相关功能必须消费绝对坐标，包括搜索跳转、居中、框选、自动布局落点、粘贴偏移、进组/出组还原。
* 导入/导出链路必须明确区分旧文件与新文件的坐标模式，避免误判。
* 坐标转换需要收敛到统一模块，禁止业务代码继续手写 `parent.position +/- child.position`。
* 方案需要覆盖至少以下入口：保存、读取、拖拽结束、分组创建、解散分组、加入分组、移出分组、粘贴、定位。

## Acceptance Criteria (evolving)

* [ ] frontend spec 文档明确规定坐标真值、模块边界、读写契约、迁移策略、验证矩阵。
* [ ] spec 包含当前仓库的实际问题来源与受影响入口，不是抽象原则文档。
* [ ] spec 索引更新后，后续实现与检查流程能直接将该文档作为上下文输入。

## Definition of Done (team quality bar)

* PRD 已记录问题、决策、范围与关键文件入口
* frontend code-spec 已落地到 `.trellis/spec/frontend/`
* spec 索引已更新
* 后续实现所需的边界、迁移策略、验证点已经足够清晰

## Out of Scope (explicit)

* 本轮不直接修改生产代码
* 本轮不处理 Group 视觉样式或交互文案
* 本轮不引入浏览器联调或构建验证

## Technical Notes

* React Flow 子流文档：`dev/instructions/react-flow/learn/layouting/sub-flows.mdx`
* 当前高风险实现入口：
  * `src/stores/flow/utils/nodeUtils.ts`
  * `src/stores/flow/slices/nodeSlice.ts`
  * `src/stores/flow/slices/graphSlice.ts`
  * `src/core/parser/importer.ts`
  * `src/core/parser/nodeParser.ts`
  * `src/components/panels/main/SearchPanel.tsx`
  * `src/components/panels/main/node-list/NodeListPanel.tsx`
  * `src/services/crossFileService.ts`
* 统一转换模块建议放在 `src/stores/flow/utils/coordinateUtils.ts`，以便 store、parser、组件定位入口复用；纯函数不得依赖 React 组件状态。
