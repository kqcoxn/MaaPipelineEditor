# 调整调试中控台节点选择布局

## Goal

优化调试模块中控台“当前 / 最新运行”区域的节点选择控件布局：节点选择框更窄，“检索所有 JSON 节点”勾选项与选择框处于同一行，减少该区域纵向占用。

## What I already know

- 入口位于 `src/features/debug/components/panels/OverviewPanel.tsx`。
- 现有布局使用 `Space direction="vertical"` 包裹 `Select` 与 `Checkbox`，导致 checkbox 单独换行。
- 用户明确要求“当前/最新运行”的节点选择框拉窄一些，并把检索所有节点的 check 放在同一行。

## Requirements

- 将“当前 / 最新运行”区域中的节点选择框宽度从当前偏宽的弹性布局调窄。
- 将“检索所有 JSON 节点”checkbox 与节点选择框放在同一行。
- 保持现有运行按钮、节点搜索、选项渲染、checkbox 状态逻辑不变。
- 在较窄宽度下布局应允许自然换行，不造成控件重叠。

## Acceptance Criteria

- [ ] `Select` 与“检索所有 JSON 节点”checkbox 在常规桌面宽度下同一行展示。
- [ ] 节点选择框比原先更窄，不再默认占满整行。
- [ ] 无运行逻辑、状态逻辑、调试协议变更。
- [ ] 通过针对该文件的语法/静态检查；不运行 `yarn dev` 或浏览器测试。

## Definition of Done

- 局部 UI 样式修改完成。
- Trellis 上下文已记录。
- 按项目约束只做必要语法/静态检查。

## Out of Scope

- 不调整 DebugModal 其它面板。
- 不修改调试运行行为或后端 LocalBridge。
- 不新增测试脚本、总结文档或浏览器验证。

## Technical Notes

- 相关前端规范入口：`.trellis/spec/frontend/index.md`。
- 共享思考指南入口：`.trellis/spec/guides/index.md`。
