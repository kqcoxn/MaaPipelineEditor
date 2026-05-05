# 微调日志面板内容模块

## Goal

微调更新日志弹窗右侧详情区的头部与内容展示方式，让信息更紧凑：将日期放到右侧并与更新量合并展示，同时移除横向分类筛选栏，默认直接展示全部更新内容。

## What I already know

* 用户明确要求调整“日志面板右下的具体内容模块”。
* 实际实现位于 `src/components/modals/UpdateLog.tsx` 的 `UpdateLogDetails`。
* 当前头部布局为左侧版本号 + 标签 + 日期，右侧单独展示“共x项更新”。
* 当前详情区存在 `Segmented` 横向分类筛选，并基于 `categoryFilter` 控制显示分类。

## Assumptions (temporary)

* 本次仅调整前端展示，不修改 `src/data/updateLogs.ts` 数据结构。
* 默认展示全部分类，分类区块顺序保持现有 `categoryConfig` 顺序。
* 不调整左侧版本时间线、预告面板、置顶公告等其他区域。

## Open Questions

* 无阻塞问题，按当前需求直接实现。

## Requirements (evolving)

* 版本详情头部右侧展示文案改为“日期 共x项更新”。
* 日期不再单独放在左侧版本标题下方。
* 移除横向分类筛选栏及其相关交互状态。
* 详情内容默认展示所有有内容的分类分组。

## Acceptance Criteria (evolving)

* [ ] 打开任意版本日志时，头部右侧显示“YYYY-MM-DD 共x项更新”。
* [ ] 详情区不再出现分类筛选栏。
* [ ] 详情区直接展示该版本全部有内容的分类。
* [ ] 预告面板与版本时间线行为不受影响。

## Definition of Done (team quality bar)

* 仅完成本次展示层微调，不扩散到无关区域。
* 通过针对修改文件的语法/静态检查。
* 如实现过程中产生可复用约束，评估是否需要更新 spec。

## Out of Scope (explicit)

* 不改更新日志数据内容与分类定义。
* 不新增新的筛选/折叠/排序交互。
* 不调整弹窗整体布局和左侧时间线结构。

## Technical Notes

* 目标文件：`src/components/modals/UpdateLog.tsx`
* 相关样式：`src/styles/modals/UpdateLog.module.less`
* 参考约束：`.trellis/spec/frontend/index.md`、`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`
