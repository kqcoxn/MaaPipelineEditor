# MPE Landing 站项目文档

基于 [01a-landing-page-blueprint.md](./01a-landing-page-blueprint.md) 的 7 段式 Landing 架构，为 MaaPipelineEditor（MPE）定制一套独立官网首页方案。该站点用于品牌展示、能力说明与转化承接，不并入根目录现有编辑器工程，也不并入现有文档站。

## 1. 项目定义

### 1.1 项目目标

- 为 MPE 提供一个独立的 Landing 站，承担“品牌首页”角色。
- 让首次访问者在 5 到 8 秒内理解 MPE 是什么、适合谁、该从哪里开始。
- 在不改变蓝图 UI 架构的前提下，把整体气质从通用 SaaS 首页调整为更符合 MPE 的“流程编辑器 / 工具工作台”风格。
- 承接 3 个主要流向：在线编辑器、文档站、GitHub 仓库。

### 1.2 非目标

- 不承载编辑器本体功能。
- 不替代文档站的详细说明、安装指南和 API 说明。
- 不复用根目录 Vite 工程作为 Landing 外壳，避免后续营销页与应用页相互牵制。

### 1.3 成功标准

- 用户能快速理解 MPE 的核心价值：把 MaaFramework Pipeline 从 JSON 变成可读、可改、可调试的图形工作流。
- 首页首屏点击主要集中到“在线使用”和“查看文档”。
- 页面在桌面端与移动端都保留同样的结构顺序，只调整布局和密度。
- Landing 站可独立构建、独立部署、独立演进。

## 2. 站点定位

### 2.1 一句话定位

MPE 是面向 MaaFramework 资源开发者的可视化 Pipeline 审阅与编辑工作台。

### 2.2 目标受众

- 正在编写或维护 MaaFramework Pipeline 的资源开发者。
- 初次接触 Maa Pipeline、希望降低理解门槛的开发者。
- 需要审阅其他项目 Pipeline 逻辑的协作者或贡献者。
- 关注 AI 辅助、MCP 联动和本地增强能力的高级用户。

### 2.3 转化目标

- 主转化：进入在线编辑器。
- 次转化：查看文档站。
- 信任转化：访问 GitHub、查看案例截图、了解历史演进。

## 3. 复用原则

本方案明确复用蓝图中的“UI 架构与布局节奏”，但不复用其业务表达和视觉风格。

### 3.1 必须复用的部分

- Header / Hero / Features / Showcase / Stats / CTA / Footer 的 7 段式顺序。
- Hero 首屏左文案右视觉的主叙事方式。
- Features 的“切换功能 -> 看 demo -> 读说明”结构。
- Showcase 的高视觉密度、低文案策略。
- CTA 的二次收口作用。

### 3.2 必须替换的部分

- 所有业务文案、截图和案例内容。
- 视觉语义，从“泛 AI/SaaS”改为“流程图编辑器 / 节点工作台 / 工程工具”。
- CTA 行为，从“注册 / 预约”改为“在线使用 / 查看文档 / 打开 GitHub”。

## 4. 页面信息架构

### 4.1 页面总结构

沿用蓝图的 7 段式结构：

1. Sticky Header
2. Hero 首屏
3. Features 功能展示
4. Showcase 场景与结果展示
5. Stats 信任背书
6. CTA 转化区
7. Footer

### 4.2 MPE 版本区块映射

| 区块 | 目标 | MPE 内容方向 | 关键动作 |
| --- | --- | --- | --- |
| Header | 快速建立识别与入口 | 品牌、锚点导航、GitHub、在线使用 | 导航跳转 / 打开编辑器 |
| Hero | 5 秒内讲清产品价值 | 图形化 Pipeline 编辑、审阅、调试、AI 辅助 | 在线使用 / 查看文档 |
| Features | 解释能力而不是堆卖点 | 可视化审阅、本地增强、调试模板、AI/MCP | 切换 tab 查看 demo |
| Showcase | 展示真实使用场景 | 复杂 Pipeline、跨项目审阅、辅助工具、迁移兼容 | 查看案例 / 跳文档 |
| Stats | 建立信任 | 无需安装、一行启用、协议兼容、持续演进 | 强化可信度 |
| CTA | 二次收口 | 打开编辑器开始整理你的 Pipeline | 在线使用 |
| Footer | 收尾与补充导航 | 产品、资源、社区、GitHub、协议/鸣谢 | 外链跳转 |

### 4.3 Header 设计

- 左侧：MPE Logo + `MaaPipelineEditor`
- 中间：`能力`、`场景`、`生态`、`文档`
- 右侧辅助动作：`GitHub`
- 主 CTA：`在线使用`

说明：

- 不放复杂导航，不放搜索。
- `生态` 可指向文档中的 LocalBridge、Extremer、MCP 相关内容。
- 首版不强制做中英切换，先以 `zh-CN` 为主，保留后续 i18n 能力。

### 4.4 Hero 设计

#### Hero 文案目标

- 讲清楚“这是什么”：MaaFramework Pipeline 可视化编辑器。
- 讲清楚“为什么值得看”：比手调 JSON 更易读、更易改、更易调试。
- 讲清楚“下一步去哪里”：直接在线打开，或先看文档。

#### 建议文案方向

- Eyebrow：`为 MaaFramework 资源开发者而生`
- H1：`把 MaaFramework Pipeline 从 JSON 变成可读、可改、可调试的图形工作流`
- Supporting Copy：突出可视化审阅、复杂逻辑梳理、本地增强、AI 与 MCP 联动。
- Primary CTA：`在线使用`
- Secondary CTA：`查看文档`

#### Hero 视觉设计

Hero 右侧沿用蓝图的“大视觉证明块”，但内容改成 MPE 风格：

- 一个主编辑器画面作为核心视觉。
- 叠加 3 个浮层卡片。
- 浮层内容分别表现 `节点搜索 / AI 补全`、`LocalBridge / 本地能力`、`模板 / 调试 / OCR`。

视觉上避免通用 3D SaaS mockup，改为更像“流程画布 + 节点卡片 + 连接线 + 浮层面板”的组合。

### 4.5 Features 设计

Features 必须保留蓝图的“tab 切换 + 演示面板 + 说明区”结构。

建议 4 个 tab：

1. `审阅与编辑`
2. `本地增强`
3. `调试与模板`
4. `AI 与 MCP`

每个 tab 采用统一布局：

- 左：动态 demo 面板
- 右：标题、2 到 3 行说明、1 组短标签

建议内容如下：

| Tab | Demo 内容 | 说明重点 |
| --- | --- | --- |
| 审阅与编辑 | 大型 Pipeline 画布截图 + 关键路径高亮 | 复杂流程也能按节点和连线阅读 |
| 本地增强 | 文件管理、截图、OCR、小工具面板 | 在线编辑之外，还能按需接入本地能力 |
| 调试与模板 | 流程调试画面、模板列表、字段填充 | 提高构建效率，减少重复配置 |
| AI 与 MCP | 节点搜索、AI 补全、MCP 联动画面 | 让流程定位与生成更智能 |

### 4.6 Showcase 设计

Showcase 用来展示“结果长什么样”，不再重复解释功能。

建议使用 4 张真实案例卡：

1. 编辑复杂 Pipeline
2. 快速审阅其他项目逻辑
3. 使用内置辅助工具补全内容
4. 平滑迁移旧项目或混合导入协议

建议优先复用现有素材：

- `public/readme/展示.png`
- `public/readme/分组.png`
- `public/readme/审阅.png`
- `public/readme/big-pie.png`

这些素材在 Landing 站中应重新导出为压缩后的 `webp` 或 `avif`，并增加统一的卡片壳层、标题、标签和说明。

### 4.7 Stats 设计

Stats 区块建议先使用“真实且无需夸大”的数字型信息，不必强行上虚高指标。

首版可用如下表达：

- `0 安装`：打开网页即可开始编辑
- `1 行命令`：按需启用本地增强服务
- `2 代协议`：支持节点级 v1 / v2 混合导入
- `2025 起`：项目持续演进至今

如果后续 GitHub Stars、案例数量、贡献者数量更稳定，也可以替换其中 1 到 2 项。

### 4.8 CTA 设计

CTA 区块保持蓝图的“大标题 + 低风险说明 + 一个主按钮”结构。

建议文案方向：

- 标题：`打开 MPE，让 Pipeline 先变清楚，再变复杂`
- 说明：`无需安装，先在线查看、编辑和审阅你的流程结构`
- 按钮：`立即在线使用`

### 4.9 Footer 设计

Footer 建议分 4 列：

- 品牌简介
- 产品入口：在线使用、预览版、更新日志
- 资源入口：文档、示例、GitHub、Issue
- 社区与协议：交流群、License、鸣谢

## 5. 视觉风格策略

Landing 页虽然复用同样结构，但风格不应像常规 SaaS 模版，而应更像“工程化流程工作台的品牌首页”。

### 5.1 风格关键词

- 流程画布
- 节点连接
- 轻量工作台
- 工程感
- 可视化审阅
- 明亮而不空

### 5.2 视觉方向

- 整体基调使用浅色画布，而不是深色科技风。
- 背景加入非常轻的网格、点阵或连接线路纹理，呼应 Pipeline 语义。
- 面板采用白底或冷灰底，模拟编辑器中的工作区和浮层卡片。
- 品牌强调色以 MPE 蓝为主，再用青绿、橙、玫红做节点连线和状态点缀。

### 5.3 建议色板

```text
Canvas      #F5F7FB
Panel       #FFFFFF
Ink         #142033
Subtle      #60708A
Primary     #4F86FF
Mint        #43C7B8
Orange      #FF9B62
Rose        #D96B88
Grid Line   rgba(95, 113, 140, 0.12)
```

### 5.4 字体建议

- 正文字体：`IBM Plex Sans` + `Noto Sans SC`
- 标题字体：延续正文字体体系，通过字重和字距做差异
- 等宽字体：`JetBrains Mono`

说明：

- 不使用泛默认系统风格，也不走夸张未来感字体。
- MPE 本质是工具型产品，字体应优先服务可读性与工程感。

### 5.5 卡片语言

- 大圆角，但不要过度柔软，建议 `20px` 到 `28px`
- 白底 / 浅灰底卡片
- 细边框 + 轻阴影
- hover 仅做轻微抬升和阴影变化
- 卡片内部常配短标签、状态点、辅助线或简短参数

### 5.6 动效原则

- Hero 连接线与浮层卡片可有轻微漂浮感
- Features 切换时做淡入与轻微上移动效
- Showcase 卡片 hover 微抬升
- CTA 背景可有极轻的扫描线或流动光斑

避免：

- 自动播放大视频
- 过多滚动绑定复杂动画
- 不同模块使用完全不同的动效语言

## 6. 内容策略

### 6.1 内容基调

- 语言更像“开发工具官网”，不是“消费级产品广告”。
- 多用具体能力和使用结果，少用空泛形容词。
- 首屏和 Features 说清价值，往下文案逐步收敛。

### 6.2 推荐 CTA 体系

- 主 CTA：`在线使用`
- 次 CTA：`查看文档`
- 辅助 CTA：`查看 GitHub`
- 场景 CTA：`查看示例 Pipeline`

### 6.3 推荐文案关键词

- 可视化审阅
- 图形化编辑
- 关键路径高亮
- 本地能力增强
- 节点模板
- 协议兼容
- AI 补全
- MCP 联动

### 6.4 资产准备建议

- 复用现有 README 截图作为首版素材。
- 为 Hero 单独制作一张裁切更克制的主视觉。
- 为 Features 每个 tab 准备 1 张主图和 1 组标签。
- 单独制作 Open Graph 封面图。

## 7. 技术方案

### 7.1 方案结论

推荐使用：

- `Astro 5`
- `TypeScript`
- `Tailwind CSS 4`
- `React 19` 仅用于少量交互岛屿
- `Motion One` 或原生 CSS 动效
- `Embla Carousel` 用于移动端 Showcase 横滑
- `astro:assets` 处理图片与响应式资源
- `Plausible` 或 `Umami` 做轻量统计
- `Playwright` 做核心页面 smoke test

### 7.2 为什么不是直接复用主项目技术栈

Landing 站的核心诉求是：

- 静态内容优先
- 极快首屏
- SEO 友好
- 少量交互，而不是重应用状态管理

因此 Astro 比直接用完整 React SPA 更合适。它可以保留 React 在局部交互区的开发体验，又避免整站被前端应用化。

### 7.3 为什么推荐 Astro

- 默认适合营销站、官网和文档入口。
- 静态输出简单，部署成本低。
- 图片优化与内容组织能力成熟。
- 只有 Features、移动菜单等局部区域需要 hydration。
- 后续如果要加英文版、博客或案例页，也比较容易扩展。

## 8. 工程边界与目录建议

### 8.1 目录位置

推荐在仓库中新增独立目录：

```text
sites/
  landing/
```

不建议把 Landing 直接并入当前根目录 `src/`，也不建议塞入现有 `docsite/`。

### 8.2 推荐目录结构

```text
Landing
├─ package.json
├─ astro.config.mjs
├─ tsconfig.json
├─ public
│  ├─ favicon
│  └─ og
├─ src
│  ├─ assets
│  ├─ content
│  │  └─ landing.ts
│  ├─ components
│  ├─ sections
│  ├─ layouts
│  ├─ pages
│  │  └─ index.astro
│  └─ styles
│     └─ global.css
└─ tests
   └─ landing.spec.ts
```

### 8.3 数据驱动方式

页面内容建议集中在 `src/content/landing.ts`，避免把所有文案散落到组件内部。

推荐定义的数据结构：

- `siteMeta`
- `heroContent`
- `featureItems[]`
- `showcaseItems[]`
- `statsItems[]`
- `footerColumns[]`

这样后续改文案、换截图、做英文版都更容易。

## 9. 组件设计

组件层仍然沿用蓝图中的结构接口，但命名可以更贴近 MPE。

### 9.1 推荐组件清单

- `LandingShell`
- `LandingHeader`
- `HeroWorkflowScene`
- `FeatureExplorer`
- `ShowcaseGrid`
- `TrustStats`
- `FinalCtaSection`
- `LandingFooter`

### 9.2 关键组件职责

| 组件 | 职责 |
| --- | --- |
| `LandingShell` | 页面背景、容器宽度、分段节奏 |
| `LandingHeader` | 顶部导航、锚点跳转、移动端菜单 |
| `HeroWorkflowScene` | 主视觉画布、浮层卡片、连接线装饰 |
| `FeatureExplorer` | Tabs 交互、内容切换、动效切换 |
| `ShowcaseGrid` | 案例卡片网格和移动端横滑 |
| `TrustStats` | 4 个数字背书块 |
| `FinalCtaSection` | 二次转化收口 |
| `LandingFooter` | 资源链接与品牌信息 |

## 10. 部署方案

### 10.1 核心要求

- 独立构建
- 独立部署
- 不受主应用发版节奏影响
- 与文档站可分别回滚

### 10.2 推荐部署拓扑

推荐的长期目标：

- `mpe.codax.site/`：Landing 站
- `mpe.codax.site/stable/`：稳定版编辑器
- `mpe.codax.site/docs/`：文档站

如果后续托管平台不方便做同域多项目路径分流，可切换为：

- `mpe.codax.site`：Landing 站
- `editor.mpe.codax.site`：编辑器
- `docs.mpe.codax.site`：文档站

### 10.3 托管建议

优先推荐：

- Cloudflare Pages
- Vercel

原因：

- 静态站部署简单
- 适合 Astro
- 图片与 CDN 支持成熟
- 便于分别配置域名和缓存策略

### 10.4 CI/CD 建议

- 为 `Landing` 单独建立构建工作流，例如 `landing.yml`
- 仅在 `Landing/**` 及其共享资源变化时触发
- 输出静态产物，不依赖主应用构建

## 11. SEO、性能与质量要求

### 11.1 SEO

- 页面标题和描述围绕 `MaaPipelineEditor`、`MaaFramework Pipeline`、`可视化编辑器`
- 提供 Open Graph 图片
- 增加 `SoftwareApplication` 结构化数据
- 首版以 `zh-CN` 为主，保留后续 `en` 扩展位

### 11.2 性能

目标：

- Lighthouse Performance 大于等于 `95`
- 首屏主视觉图片采用响应式裁剪与现代格式
- 避免首屏加载非必要脚本
- 动效默认轻量，不依赖超大动画库

### 11.3 质量

- 桌面端与移动端都要完成视觉验收
- 键盘可访问
- Header、CTA、Tabs、轮播卡片具备基础可用性
- 关键跳转链接可由 Playwright 自动检查

## 12. 首版范围与里程碑

### 12.1 MVP 范围

- 单页 Landing
- 7 段式完整结构
- 4 个 Features tab
- 4 张 Showcase 卡片
- 4 个 Stats 项
- 响应式布局
- 基础 SEO 与统计

### 12.2 首版不做

- 多语言切换
- CMS 后台
- 博客系统
- 大量视频或复杂 3D 交互

### 12.3 后续迭代

#### V1.1

- 英文版
- 更完整的案例页
- 更新日志入口

#### V1.2

- 与文档站内容联动的“生态页”
- 更完整的案例图库或模板库入口

## 13. 验收标准

Landing 首版完成后，应满足以下标准：

- 从结构上看，与蓝图的 UI 架构和阅读节奏保持一致。
- 从风格上看，明显属于 MPE，而不是套模板的通用 SaaS 首页。
- 从工程上看，是一个独立目录、独立依赖、独立部署的站点。
- 从转化上看，首屏和页尾都能清晰引导到在线编辑器与文档。
- 从内容上看，示例、截图和数字尽量真实，不使用空泛夸张话术。

## 14. 一句话结论

这次 Landing 站应复用的是蓝图的“结构秩序”和“转化节奏”，而不是原项目的业务包装；MPE 版本的首页要像一个专业、清晰、轻量的 Pipeline 工作台入口，而不是一个泛化的 AI SaaS 展示页。
