# Wiki 临时隐藏还原记录

用途：本文件记录临时发版期间隐藏 Wiki 模块的位置，发版后按清单还原。

## 当前临时处理

- `src/wiki/visibility.ts`
  - `isWikiModuleVisible` 临时设为 `false`，作为 Wiki 模块统一可见性开关。
- `src/App.tsx`
  - `WikiModal` 渲染受 `isWikiModuleVisible` 控制。
  - URL hash 中的 `wiki` 参数自动打开逻辑受 `isWikiModuleVisible` 控制。
- `src/components/panels/tools/GlobalPanel.tsx`
  - 全局工具栏的 `MPE Wiki / 俺寻思` 按钮受 `isWikiModuleVisible` 控制。
- `src/features/wiki/components/WikiPonderTrigger.tsx`
  - 上下文 Wiki 触发器在 `isWikiModuleVisible === false` 时直接不渲染。
  - 影响调试弹窗标题、工具箱截图/ROI 等 Wiki 入口。
## 发版后还原步骤

1. 将 `src/wiki/visibility.ts` 中的 `isWikiModuleVisible` 改回 `true`。
2. 检查全局工具栏、调试弹窗标题、工具箱截图/ROI 入口是否重新显示 Wiki 触发器。
3. 检查带 `#wiki=...` 的分享/跳转链接是否能重新打开 WikiModal。
4. 确认无需继续保留本文件后再删除。
