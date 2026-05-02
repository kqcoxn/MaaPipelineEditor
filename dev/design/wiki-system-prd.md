# MPE 俺寻思（内置 Wiki 系统）PRD

## 1. Executive Summary

### Problem Statement

MPE 的业务能力越来越多，文档站适合承载安装、部署、概念说明，但不适合在用户使用某个功能时即时给出图文/动图/视频教程。用户当前需要在功能界面、文档站、更新日志之间切换，学习路径割裂，尤其是调试、工具箱、ROI、截图等操作型功能，很难通过静态文字一次讲清。

### Proposed Solution

在 MPE 内置一个统一的交互式 Wiki 系统，提供类似“按住 W 思考”的上下文帮助入口：用户在预设的帮助触点上 hover 可看到简要说明，按住 `W` 或点击/键盘确认可直接打开 Wiki 并跳转到指定条目、模块、步骤。Wiki 主体采用“条目（Entry）- 模块（Module）- 步骤（Step）”三层结构，左侧目录、右侧电子书式阅读区，上方模块 Tabs，下方步骤翻页，支持混排文字、图片、动图、视频和后续自定义组件。

### Success Criteria

- 用户在主视图左上角工具列表中能通过固定 Wiki 总入口打开内置百科。
- 用户从任意预设帮助触点进入 Wiki 后，能在 1 次交互内定位到目标条目/模块/步骤。
- Wiki 主入口首次打开时只加载目录、搜索索引和当前可见内容，不主动请求未访问模块的大型媒体资源。
- 新增一个普通教程条目时，只需要新增/修改 `src/wiki` 下的内容定义文件，不需要改动 Wiki 阅读器核心组件。
- 搜索能覆盖条目、模块、步骤标题、摘要、关键词，并能打开到具体步骤。
- UI 风格与现有 MPE Modal 保持一致，同时通过页面质感、步骤翻页和媒体展示形成“内置电子书”体验。

## 2. User Experience & Functionality

### User Personas

- **初次使用者**：需要在操作现场理解“这个按钮/面板是干什么的”，不希望跳出应用查文档。
- **进阶使用者**：知道目标功能，但需要快速回看某一步具体操作，例如调试流程、ROI 选择、截图工具参数。
- **内容维护者**：希望以低成本持续补充教程，避免每加一页都要改阅读器代码。
- **开发者**：希望用统一组件把上下文帮助挂到按钮、表单项、工具面板或节点菜单上。

### Core Concepts

- **条目（Entry）**：Wiki 目录的一级内容，例如“调试”“工具箱”“节点编辑”“资源配置”。
- **模块（Module）**：条目下的横向内容分组，例如“功能演示”“详细教程”“常见问题”。
- **步骤（Step）**：模块下可左右翻页的最小阅读单元，通常是一段说明加一个视频/动图/图片，也可以是纯文字、混排内容或自定义组件。
- **目标（Wiki Target）**：可定位到 `entryId`、`moduleId`、`stepId` 的跳转地址，用于帮助触点、搜索结果和外部入口。
- **全局入口（Wiki Global Entry）**：主视图左上角工具列表中的固定入口，放在调试入口右侧，用于直接打开 Wiki 首页、默认条目或上次阅读位置。
- **思考入口（Ponder Trigger）**：可复用的帮助触点组件。默认呈现为问号或书本图标，hover 显示简述，按住 `W` 后打开 Wiki。

### User Stories & Acceptance Criteria

#### Story 1: 上下文帮助触点

As a user, I want to hover a help icon and hold `W` to open the relevant Wiki page so that I can learn the feature without manually searching.

Acceptance Criteria:

- 帮助触点 hover/focus 时显示简要介绍、目标标题和可用操作提示。
- 当触点处于 hover 或 focus 状态时，长按 `W` 达到阈值后打开 Wiki，并跳转到指定 `entryId/moduleId/stepId`。
- 如果焦点位于输入框、文本域、Monaco、可编辑区域或正在输入中文 IME，`W` 长按不触发跳转。
- 鼠标点击只聚焦/阻止冒泡，不打开 Wiki；上下文触点必须通过长按 `W` 跳转。
- 未配置目标或目标失效时，触点不可跳转，并显示“内容待补充”类反馈。

#### Story 2: 全局 Wiki 总入口

As a user, I want a fixed Wiki button in the main toolbar so that I can open the encyclopedia even when there is no contextual help trigger nearby.

Acceptance Criteria:

- 主视图左上角工具列表在调试入口右侧展示 Wiki 总入口。
- 总入口 hover/focus 时显示“Wiki / 俺寻思”类说明，点击或键盘 `Enter`/`Space` 打开 Wiki。
- 总入口默认打开 Wiki 首页、推荐条目或上次阅读位置；若这些状态不可用，则打开目录第一个有效条目。
- 总入口不依赖当前选中节点、当前文件或 LocalBridge 连接状态。
- 总入口的尺寸、间距、Tooltip 方向和现有工具按钮保持一致。

#### Story 3: Wiki 主阅读器

As a user, I want a book-like Wiki modal with catalog, module tabs, and step navigation so that I can follow a guided tutorial.

Acceptance Criteria:

- Wiki Modal 左侧显示条目目录，支持分组、徽标、摘要和当前选中态。
- 右侧顶部显示当前条目标题、摘要、搜索入口和模块 Tabs。
- 右侧下方显示当前模块的步骤阅读区，支持上一页/下一页、步骤进度、直接跳到某一步。
- 每个步骤可展示文字、图片、GIF、视频、提示块、链接、代码片段或自定义 React 内容。
- 切换条目或模块后，阅读区保持固定尺寸和稳定布局，不因媒体加载造成大幅跳动。

#### Story 4: 搜索

As a user, I want to search the built-in Wiki so that I can find a tutorial without knowing its catalog location.

Acceptance Criteria:

- 搜索覆盖条目、模块、步骤的标题、摘要、关键词和轻量正文索引。
- 搜索结果展示命中层级，例如“调试 / 详细教程 / 第 3 步：查看节点线”。
- 点击搜索结果打开 Wiki 并定位到具体步骤。
- 空结果显示可操作的空态，不阻塞用户继续浏览目录。
- MVP 不要求语义搜索、拼音搜索或 AI 问答。

#### Story 5: 内容扩展

As a content maintainer, I want to add Wiki content through typed files so that new tutorials are easy to write and hard to break.

Acceptance Criteria:

- 内容定义集中存放在 `src/wiki`，核心阅读器不直接散落业务文案。
- 新条目必须通过 TypeScript 类型校验，至少包含 id、标题、摘要、关键词、模块和步骤。
- 普通图文/视频步骤通过数据结构声明；复杂交互步骤可选择 lazy React 组件。
- 媒体资源有明确的加载策略、alt/caption 要求和推荐格式。
- 无效目标、重复 id、空模块、空步骤应在开发期尽早暴露，优先通过类型和运行时校验组合解决。

### UX Interaction Details

#### Ponder Trigger

推荐封装为 `WikiPonderTrigger`（命名可在实现时调整），面向业务方暴露稳定 props：

```ts
interface WikiTarget {
  entryId: string;
  moduleId?: string;
  stepId?: string;
}

interface WikiPonderTriggerProps {
  target: WikiTarget;
  title: string;
  description: string;
  icon?: React.ReactNode;
  placement?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}
```

交互建议：

- 默认图标使用 `QuestionCircleOutlined` 或更像“百科/书本”的图标，避免在密集工具栏里占用过多空间。
- hover/focus 显示 Ant Design Tooltip，内容包含标题、1-2 句说明、操作提示。
- `W` 长按阈值建议从 `600ms` 起步，过程中可显示轻量环形/进度反馈；阈值后打开 Wiki。
- 点击图标不直接打开 Wiki，避免误触；需要 hover/focus 后长按 `W`。
- 触点只在自身 hover/focus 时监听 `W`，不做全局任意位置 `W` 跳转，降低误触。

#### Global Wiki Entry

全局入口用于解决“我现在只是在主视图浏览，没有具体帮助触点可 hover”的场景：

- 入口放在主视图左上角工具列表中，位置在调试入口右侧。
- 图标建议使用书本、百科或问号类图标；Tooltip 使用“Wiki / 俺寻思”或最终确定的用户可见名称。
- 点击打开 Wiki，总入口本身不需要 `W` 长按，避免和上下文触点的语义混淆。
- 打开目标优先级建议为：显式默认首页 > 上次阅读位置 > 目录第一个有效条目。
- 该入口是 P1 基础框架的一部分，不应等到业务触点接入后才出现。

#### Wiki Modal Layout

整体参考现有 DebugModal 的 Modal 尺寸、左侧导航和固定内容高度模式，但阅读区要更像电子书：

- Modal 宽度建议 `min(1180px, calc(100vw - 48px))` 起步，后续可视内容密度调整到 `1280px`。
- 左侧目录宽度建议 `220-260px`，可滚动，显示条目标题、短摘要、状态标识。
- 右侧内容区分为：
  - 头部：条目标题、短摘要、搜索框、必要的打开来源提示。
  - 模块栏：Ant Design Tabs，使用 v6 `items` 写法。
  - 步骤阅读区：固定高度，内部左右翻页；媒体区域和文字区域使用响应式网格。
- 页面质感通过浅色纸面背景、细边框、稳定留白、页码/步骤指示营造，不使用和 MPE 主界面割裂的重装饰。
- 大型媒体加载前用 Skeleton/占位封面保持尺寸；错误时显示可恢复的错误块。

#### Search UX

- Modal 内右上角提供搜索框；输入后可在右侧顶部或浮层展示结果。
- 搜索结果按层级和命中权重排序：精确 id/标题 > 关键词 > 摘要 > 正文索引。
- 结果点击后清空或折叠结果面板，并定位到对应步骤。
- 搜索不应强制加载所有模块正文和媒体；MVP 只依赖轻量索引。

### Non-Goals

- 不把文档站整体迁入 MPE；安装方式、部署说明、版本兼容等非业务说明仍可留在文档站。
- 不做用户可编辑 Wiki、CMS、远程内容下发或在线评论。
- 不做 AI 问答、语义检索、自动生成教程。
- 不要求首版覆盖所有功能模块；首版应提供结构、示例内容和一到两个高价值条目。
- 不做旧 Wiki API 兼容；当前 `src/wiki` 为空目录，可直接按新模型建立。
- 不在首版支持多语言；若后续需要，再将内容层拆成 locale 维度。

## 3. AI System Requirements

不适用。当前系统是本地静态/半静态 Wiki，不引入 AI 生成、AI 检索或外部模型调用。

## 4. Technical Specifications

### Current Context

- 仓库中已有空的 `src/wiki` 目录，可作为内容源目录。
- `src/data/updateLogs.ts` 已在后续预告中出现 Wiki / “俺寻思”方向，说明该功能已有产品预期。
- 现有 DebugModal 使用 Ant Design Modal、左侧导航、固定高度内容区和 `destroyOnHidden`，可作为 Wiki Modal 风格基线。
- 项目依赖已有 `antd@6`、`react@19`、`zustand@5`、`react-markdown`，可覆盖首版 Modal、Tabs、Tooltip、状态管理和 Markdown 渲染需求。
- 本地 Ant Design v6 迁移文档提示：Modal 使用 `styles.body`，Tabs 使用 `items`，Tooltip 使用 `destroyOnHidden` 等 v6 写法。

### Recommended Architecture

```text
src/
  wiki/
    types.ts
    registry.ts
    searchIndex.ts
    entries/
      debug/
        index.ts
        showcase.ts
        tutorial.ts
        assets/
      toolbox/
        index.ts
        roi.ts
        screenshot.ts
  features/
    wiki/
      components/
        WikiModal.tsx
        WikiCatalog.tsx
        WikiModuleTabs.tsx
        WikiStepReader.tsx
        WikiSearchBox.tsx
        WikiPonderTrigger.tsx
      hooks/
        useWikiController.ts
        useWikiHotkey.ts
        useWikiSearch.ts
      wikiContentLoader.ts
      wikiTarget.ts
  stores/
    wikiStore.ts
    wikiMemoryStore.ts
```

职责划分：

- `src/wiki`：只放内容、内容类型、轻量索引和媒体资源引用。
- `features/wiki`：放阅读器 UI、触点组件、搜索逻辑、懒加载控制。
- `stores/wikiStore.ts`：管理 Modal open、当前 target、当前条目/模块/步骤、模块加载状态。
- `stores/wikiMemoryStore.ts`：只持久化低风险偏好，例如上次打开条目、阅读布局选项；不记录用户业务数据。

### Content Model

推荐使用 TypeScript，而不是纯 JSON：

- TS 可以提供类型约束、id 自动提示和编译期检查。
- TS 可以自然承载 `loader: () => import(...)`，便于模块级懒加载。
- TS/TSX 可以允许复杂步骤按需渲染自定义 React 组件。
- JSON 更适合外部 CMS，但当前首版没有 CMS 需求，反而会削弱媒体和组件扩展能力。

建议内容模型：

```ts
export interface WikiEntryMeta {
  id: string;
  title: string;
  summary: string;
  keywords?: string[];
  modules: WikiModuleMeta[];
}

export interface WikiModuleMeta {
  id: string;
  title: string;
  summary: string;
  keywords?: string[];
  loader: () => Promise<{ default: WikiModule }>;
}

export interface WikiModule {
  id: string;
  title: string;
  summary?: string;
  steps: WikiStep[];
}

export interface WikiStep {
  id: string;
  title: string;
  summary?: string;
  keywords?: string[];
  blocks: WikiContentBlock[];
}
```

内容块建议先支持：

- `paragraph`：普通文字。
- `markdown`：少量富文本，默认不启用原始 HTML。
- `image`：静态图，必须有 alt，可选 caption。
- `video`：视频/动图替代，必须有 poster 或固定占位。
- `callout`：提示、注意、警告。
- `code`：短 JSON/配置片段。
- `component`：复杂交互内容，使用 lazy loader。

### Lazy Loading & Media Strategy

目标是“目录和索引常驻，内容和媒体按需”：

- `registry.ts` 只导出条目、模块元数据和模块 loader，不导入大型媒体。
- 用户打开某个模块时才执行对应 `loader`。
- 阅读器只挂载当前步骤，最多预挂载相邻一步的轻量壳；不要把整个模块的所有视频同时放进 DOM。
- 图片使用 `loading="lazy"`、`decoding="async"`，并保留稳定宽高或 aspect-ratio。
- 视频优先使用 `webm/mp4` 替代大 GIF；`preload="metadata"`，仅当前步骤播放或加载主体资源。
- 当前步骤加载完成后，可在 idle 阶段预取下一步模块代码或 poster，不预取所有视频主体。
- 关闭 Modal 时保留已加载模块的内存缓存，但不强制保留视频播放状态。
- 大型媒体文件需要建立体积约束：单个教程视频优先控制在 3-8MB 以内，超大内容拆步骤或压缩。

### Search Design

MVP 搜索使用本地轻量索引：

- 索引来源：entry/module/step 的 `title`、`summary`、`keywords`、可选 `searchText`。
- 索引常驻体积应控制在几十 KB 级别；不把完整 Markdown 正文和媒体描述全量塞入主入口。
- 查询处理：trim、lowercase、基础中英文子串匹配。
- 排序权重：标题精确命中 > 标题包含 > 关键词 > 摘要/搜索文本。
- 搜索结果结构包含 `WikiTarget`，点击即可定位。

后续可增强：

- 拼音首字母。
- 模块正文按需加入索引。
- 根据当前页面上下文提升相关条目排序。

### Routing & Deep Link

首版不要求接入浏览器 URL 路由。内部跳转统一使用 `WikiTarget`：

```ts
openWiki({ entryId: "debug", moduleId: "tutorial", stepId: "start-run" });
```

后续如果需要分享或从更新日志跳转，可增加 URL 参数或 hash，但不应作为 MVP 阻塞项。

### State & Persistence

需要区分当前会话状态和持久偏好：

- 当前会话状态：Modal 是否打开、当前 target、已加载模块缓存、搜索输入、媒体加载状态。
- 持久偏好：上次打开条目、目录折叠状态、是否自动播放视频等低风险设置。
- 不持久化用户搜索历史、具体阅读路径或和项目文件相关的数据。

建议 localStorage key：

- `mpe_wiki_reader_memory_v1`

### Integration Points

首批推荐接入位置：

- 左上角全局工具列表：在调试入口右侧增加 Wiki 总入口，作为主视图固定打开方式。
- 工具箱面板：ROI 工具、截图工具、OCR、模板工具。
- 调试入口：DebugModal 标题区、调试配置、节点线/事件线/图像等面板。
- 节点字段面板：高复杂字段旁边的轻量帮助触点，但只解释字段/教程，不展示运行态 debug 信息。
- 更新日志预告中的 Wiki 入口：可作为全局 Wiki 主入口。

每个接入点只传入 `WikiTarget` 和简述，不直接 import 具体教程模块，避免业务组件把内容块打入主包。

### UI Consistency Requirements

- 使用 Ant Design v6 组件和当前项目图标体系。
- Modal、Tabs、Tooltip 遵循 v6 写法，例如 Tabs `items`、Modal `destroyOnHidden`、`styles.body`。
- 不使用和 MPE 主界面割裂的强装饰、超大营销式 Hero 或复杂背景。
- 阅读区可以有“纸面/书页”质感，但边框、圆角、阴影应克制，避免与工具型 Modal 冲突。
- 所有按钮/图标需要有可读 tooltip 或 aria label。
- 长标题、路径、说明文字必须可换行，不使用容易挤爆的 Tag 承载长文本。

### Content Maintenance Requirements

- 新增条目只改 `src/wiki` 内容层和必要素材，不改阅读器核心组件。
- 媒体素材放在对应条目的 `assets` 目录，例如 `src/wiki/entries/debug/assets/`。
- 图片优先使用 `webp/png`，视频优先使用 `webm/mp4`；文件名使用小写短横线，表达条目和步骤语义。
- 每个图片/视频 block 必须提供 `alt` 或 `title`，推荐补充 `caption` 和稳定 `aspectRatio`。
- 每个步骤只表达一个操作目标；长教程拆成多个步骤，不把多段流程压进一页。
- 新增或修改步骤正文时同步维护 `searchText` 和模块导出的 `searchIndex`，保证搜索不需要加载媒体本体。
- 大型媒体不要在 registry 或搜索索引中 import；只允许在对应模块内容文件中按步骤引用。

### Accessibility & Keyboard

- `WikiPonderTrigger` 支持 focus 后长按 `W` 打开，点击不打开。
- `W` 长按只在触点 hover/focus 时有效；输入态不触发。
- Wiki Modal 内支持 `Esc` 关闭、左右方向键翻页，但焦点在输入框/视频控件时不抢键。
- 视频必须有 controls；自动播放仅允许 muted 且当前步骤可见。
- 图片和视频 poster 需要 alt/caption 或等价文本说明。

### Security & Privacy

- Wiki 内容默认来自本地源码和本地打包资源，不加载外部追踪脚本。
- Markdown 渲染不启用原始 HTML，避免内容层注入风险。
- 外链必须显式标记并使用安全打开方式。
- 搜索和阅读状态不上传、不遥测。

### Validation Plan

实现阶段遵守当前仓库约束：

- 不运行 `yarn dev`，不做浏览器自动化测试。
- 不跑前后端构建检测，必要时只做目标文件语法/ESLint 检查。
- 可用静态检查验证：重复 id、失效 target、空模块/步骤、内容块缺少 alt/poster。
- 媒体懒加载需要通过代码审查确认：未访问模块不 import 大型媒体，未激活步骤不挂载视频主体。

## 5. Risks & Roadmap

### Technical Risks

- **主包体积膨胀**：如果 registry 直接 import 所有内容和媒体，Wiki 会拖慢应用启动。
  - Mitigation: registry 只保留元数据和 dynamic import loader。
- **视频/GIF 资源过大**：教程主要靠动图/视频时，资源体积可能快速失控。
  - Mitigation: 优先 webm/mp4，限制单文件体积，poster 占位，按步骤加载。
- **`W` 快捷键误触**：MPE 有大量输入、编辑场景，错误触发会干扰工作流。
  - Mitigation: 只在触点 hover/focus 时监听，输入态禁用，点击作为主兜底。
- **内容维护成本上升**：Wiki 多媒体内容容易过期或重复。
  - Mitigation: 三层结构固定，内容文件集中，条目内保留 owner/updatedAt 可选字段。
- **UI 过于像文档站**：如果只是左侧目录加 Markdown，会失去“内置交互书”的特质。
  - Mitigation: 步骤翻页、媒体优先、上下文跳转和可复用触点作为核心体验。

### Phased Rollout

#### P0: PRD 固化与内容模型确认

- 明确三层 Wiki 信息架构。
- 确定 TS 内容源、懒加载策略和触点交互。
- 产出本 PRD，后续实现阶段以此为边界。

#### P1: Wiki 基础框架

- 建立 `src/wiki` 类型、registry 和示例条目。
- 建立 `wikiStore`、`wikiMemoryStore`、`openWiki(target)` 入口。
- 实现 `WikiModal` 基础布局：左侧目录、右侧模块 Tabs、步骤阅读区。
- 在主视图左上角工具列表的调试入口右侧接入 Wiki 总入口。
- 不接入大量业务触点，先保证主入口可打开和浏览示例内容。

#### P2: Ponder Trigger 与上下文跳转

- 实现 `WikiPonderTrigger`。
- 支持 hover/focus 简介和 `W` 长按打开，点击不打开。
- 接入 2-3 个高价值位置，例如 DebugModal、ROI 工具、截图工具。
- 增加 target 校验，失效 target 给出开发期提示。

#### P3: 搜索与媒体懒加载闭环

- 实现本地轻量搜索。
- 完成模块级 dynamic import、步骤级媒体挂载、相邻步骤预取。
- 增加图片/视频加载态、错误态和固定尺寸策略。
- 补齐首批正式内容：调试功能演示、调试方法、ROI 工具、截图工具。

#### P4: 内容扩展与体验打磨

- 扩展更多条目，例如工具箱、节点编辑、资源配置、AI 总结。
- 优化电子书视觉质感、移动/窄屏布局、键盘翻页。
- 建立内容维护规范：媒体体积、命名、alt/caption、步骤粒度。

#### P5: 后续增强

- 可选 URL/hash 深链。
- 可选拼音/首字母搜索。
- 可选“当前页面推荐条目”排序。
- 可选教程阅读进度标记。

### Open Questions

- 最终用户可见名称是否直接叫“俺寻思”，还是“Wiki / 俺寻思”并存，避免新用户不理解？
- 全局入口默认打开 Wiki 首页、上次阅读位置，还是第一个推荐条目？
- `W` 长按阈值是否采用 `600ms`，以及是否需要可配置？
- 首批正式条目优先级是否定为“调试 + 工具箱 ROI/截图”，还是先从更新日志预告的 Wiki 主入口做最小内容？
- 大型视频资源放在 `src/wiki/**/assets` 随 Vite 打包，还是放在 `public/wiki-assets` 以便更直观管理体积？
- 是否需要在首版考虑英文内容或仅中文？

## Document Record

- 2026-05-02: P0 PRD 初稿，基于内置 Wiki / “按住 W 思考”需求建立三层模型、交互方案、懒加载策略和阶段计划。
- 2026-05-02: P1 完成记录，建立 `src/wiki` TS 内容模型、调试/工具箱示例条目、Wiki store、基础阅读器 Modal，并在主视图左上角调试入口右侧接入 “MPE Wiki / 俺寻思” 总入口；P1 未实现上下文 `WikiPonderTrigger`、长按 W 跳转、搜索和正式媒体教程。
- 2026-05-02: P2 完成记录，新增可复用 `WikiPonderTrigger`，支持 hover/focus 简介、局部长按 `W` 进度反馈与跳转，点击不打开，并接入 DebugModal 标题区、工具箱 ROI、工具箱模板截图入口；P2 未实现搜索、字段面板大范围接入和正式媒体教程扩写。
- 2026-05-02: P3 完成记录，新增轻量 Wiki 搜索索引和右侧顶部内嵌搜索 UI，搜索覆盖条目、模块、步骤和纯文本 `searchText`，并将内容块与媒体加载组件化，图片/视频支持固定比例占位、状态进度和错误态；P3 仅预留真实素材目录与文件名，不提交真实截图，不实现完整教程扩写、拼音搜索、AI 搜索或 URL 深链。
- 2026-05-02: P4/P5 完成记录，未新增 Wiki 条目，补齐阅读器键盘翻页、窄屏布局、分享链接按钮和内容维护规范；P5 仅实现 `#wiki=entry/module/step` URL 入口与分享链接，入口自动打开后立即清理 hash，不实现拼音搜索、AI 搜索、推荐排序或阅读进度。
