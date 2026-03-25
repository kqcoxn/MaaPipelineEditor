# 可复用 Landing 页结构蓝图

这份文档不是对 JadeAI 首页内容的复述，而是把它抽象成一套可迁移到其他项目的 Landing Page 结构模型。你可以复用布局、节奏、视觉关系和组件职责，但替换掉产品文案、图片、功能点和 CTA。

## 1. 使用目标

适合以下类型项目：

- AI 工具
- SaaS 产品
- 设计工具
- 效率工具
- 平台型产品
- 有“产品能力展示 + 转化入口”需求的官网首页

不直接适合：

- 纯内容型博客首页
- 电商大促页
- 社区信息流首页
- 高度依赖搜索结果的门户页

## 2. 页面总结构

推荐沿用 7 段式结构：

1. Sticky Header
2. Hero 首屏
3. Features 功能展示
4. Showcase 结果展示
5. Stats 信任背书
6. CTA 转化区
7. Footer

这套结构的核心不是“模块越多越好”，而是按照用户认知顺序组织：

1. 我来到这里，这是个什么产品
2. 它为什么值得我继续看
3. 它具体能做什么
4. 它做出来的结果长什么样
5. 它是否成熟、可信
6. 我现在应该点哪里开始

## 3. 页面骨架

可直接复用的骨架如下：

```text
Landing Page
├─ Header
│  ├─ Brand
│  ├─ Navigation
│  ├─ Secondary actions
│  └─ Primary CTA
├─ Hero
│  ├─ Eyebrow / Badge
│  ├─ Headline
│  ├─ Supporting copy
│  ├─ Primary CTA
│  ├─ Secondary CTA
│  └─ Visual proof block
├─ Features
│  ├─ Section heading
│  ├─ Feature tabs / pills
│  ├─ Demo panel
│  └─ Feature description
├─ Showcase
│  ├─ Section heading
│  ├─ Visual cards / previews
│  └─ Link to full gallery
├─ Stats
│  ├─ Short label
│  └─ 3-4 numeric proof blocks
├─ CTA
│  ├─ Final headline
│  ├─ Reassurance copy
│  └─ Primary CTA
└─ Footer
   ├─ Brand summary
   ├─ Link columns
   └─ Copyright / socials
```

## 4. 结构层设计原则

### 4.1 Header 只做四件事

- 告诉用户你是谁
- 提供 1 到 3 个最重要导航入口
- 给出一个辅助信任入口
- 始终保留一个主 CTA

建议结构：

- 左：Logo / Brand
- 中：锚点导航或少量主导航
- 右：语言切换、GitHub/案例/登录、主 CTA

建议不要：

- 在 Header 塞太多导航
- 把二级导航也放进去
- 放复杂下拉菜单
- 放搜索框，除非首页就是搜索驱动

### 4.2 Hero 必须回答 3 个问题

- 这是什么
- 为什么值得看
- 下一步点哪里

推荐内容结构：

- Eyebrow：一句极短价值标签
- H1：一句话价值主张
- Supporting Copy：补充受众、能力、收益
- CTA Group：主 CTA + 次 CTA
- Visual Proof：产品结果图、界面截图、设备 mockup 或卡片预览

Hero 的关键不是“写很多”，而是让用户 5 秒内读懂。

### 4.3 Features 用来解释“能力”，不是堆卖点

JadeAI 的首页有一个很值得复用的点：不是简单罗列图标卡片，而是“切换功能 -> 看 demo -> 读说明”。

这种结构特别适合：

- 产品功能较多
- 功能之间需要解释
- 仅靠一句标题很难让用户理解

推荐结构：

- 上方：Feature tabs / pills
- 左侧：演示区
- 右侧：标题 + 说明
- 底部：进度条或切换反馈

如果你换项目，只需要替换：

- tabs 的名称
- demo 的视觉内容
- feature 的标题和文案

不需要改动整体排版结构。

### 4.4 Showcase 展示“结果长什么样”

这个区块的作用不是解释功能，而是证明产品产出有吸引力。

适合展示：

- 模板预览
- 成品截图
- 生成结果
- 案例卡片
- 作品集缩略图
- 仪表盘卡片

推荐结构：

- 区块标题
- 3 到 6 个视觉卡片
- 移动端横向滚动，桌面端网格
- 底部一个“查看更多”入口

这个区块建议高视觉、低文案。

### 4.5 Stats 只放“瞬间能理解”的数字

不要把 stats 做成解释区，它应该是快速建立信任的压缩模块。

适合展示：

- 模板数量
- 活跃用户数
- 导出格式数
- 接口响应速度
- 覆盖国家 / 语言
- 客户数量

推荐数量：

- 3 到 4 项最佳

### 4.6 CTA 是第二次收口，不是重复 Hero

CTA 区块的目标是把看完整页的用户重新收束到一个动作。

建议包含：

- 更直接的行动标题
- 一句低风险说明
- 一个主按钮

这个区块应该在视觉上明显区别于正文区，比如：

- 渐变背景
- 高对比容器
- 更大的圆角
- 装饰图形

### 4.7 Footer 负责收尾，不抢主线

Footer 适合放：

- 品牌简介
- 产品链接
- 资源链接
- 法务链接
- 社交入口

Footer 不应该承担产品主转化任务。

## 5. 视觉层可复用规则

这些是从 JadeAI 当前实现里抽象出的可迁移规律。

### 5.1 背景分层

推荐使用 3 层背景：

- 基础背景：纯白或极浅灰
- 氛围层：渐变光斑 / 模糊色块
- 纹理层：点阵、网格、微弱 pattern

作用：

- 让页面不空
- 维持现代感
- 不需要依赖复杂插画

### 5.2 品牌强调色只管关键动作

品牌色建议只集中在：

- 主按钮
- 高亮标签
- 激活态
- 强调数字
- 少量图标

不要把整页大面积刷成品牌色，否则会失去节奏。

### 5.3 卡片体系要统一

建议统一卡片参数：

- 白底或浅色底
- `rounded-xl` 到 `rounded-2xl`
- 细边框
- 轻阴影
- hover 上浮少量距离

无论展示模板、案例还是结果图，都尽量沿用同一套卡片语言。

### 5.4 文案密度控制

推荐节奏：

- H1：1 行到 2 行
- 副标题：2 行到 4 行
- Feature 描述：2 段以内
- Showcase：尽量少字
- Stats：只保留数字 + 短标签

Landing 页的内容越往下，文案应该越收敛。

## 6. 内容替换层

下面这张映射表可以直接指导你在其他项目里替换内容。

| 区块 | JadeAI 当前承载 | 可替换成什么 |
| --- | --- | --- |
| Header CTA | 进入 Dashboard | 免费试用、预约演示、立即注册、下载应用 |
| Hero Badge | AI-Powered | 新版本、行业专用、团队协作、开源 |
| Hero H1 | 简历产品价值 | 任何一句核心产品价值主张 |
| Hero Visual | 模板缩略卡 | 产品截图、设备图、成品卡片、案例图 |
| Features Tabs | 产品功能列表 | 解决方案、产品模块、使用场景、角色能力 |
| Feature Demo | 微交互演示 | Dashboard 片段、流程图、前后对比、视频截图 |
| Showcase | 模板集 | 成功案例、客户页面、图库、场景样例 |
| Stats | 模板/语言/导出数 | 用户规模、节省时间、转化率、支持国家 |
| CTA | 开始制作简历 | 开始试用、创建工作区、预约顾问、查看方案 |

## 7. 推荐的区块尺寸与节奏

可以直接作为实现参考：

- Header：`h-16`
- Hero：`min-h-[100dvh]` 或接近全屏
- 常规 section：上下 `py-24` 到 `py-32`
- 内容容器：`max-w-7xl`
- 文字窄容器：`max-w-2xl` 或 `max-w-4xl`
- 卡片网格间距：`gap-4` 到 `gap-6`

一个非常稳定的节奏是：

- 首屏最大
- 中间解释区适中
- 结果展示区略高视觉密度
- Stats 最短
- CTA 再做一次聚焦

## 8. 响应式复用策略

### 桌面端

- Header 完整导航可见
- Hero 双按钮横排
- Features 采用左右双栏
- Showcase 走多列网格

### 移动端

- Header 收敛为 Logo + 菜单 + CTA
- Hero 按钮堆叠
- Hero 视觉区缩小但保留
- Features tabs 横向滚动
- Showcase 横向滑动卡片
- Stats 改 2x2 网格

原则是“结构不变，布局重排”，不要为移动端重新发明一套首页。

## 9. 动效复用建议

建议保留这 4 类动效：

- Hero 视觉元素轻浮动
- Features 切换时内容淡入上移
- 卡片 hover 微抬升
- CTA 背景有极轻装饰动效

建议避免：

- 首屏大面积自动播放视频
- 滚动触发过多复杂动画
- 每个模块都用不同动效语言

Landing 页动效的目标是增强“精致感”，不是制造干扰。

## 10. 最适合抽成组件的结构

如果你要在别的项目里复用，建议按下面方式抽象：

### `LandingShell`

- 负责页面整体背景、section 顺序和容器宽度

### `LandingHeader`

- 接收 `brand`, `navItems`, `secondaryActions`, `primaryAction`

### `HeroSection`

- 接收 `eyebrow`, `title`, `subtitle`, `primaryAction`, `secondaryAction`, `visual`

### `FeatureExplorer`

- 接收 `items[]`
- 每个 item 包含 `icon`, `title`, `description`, `demo`

### `ShowcaseSection`

- 接收 `title`, `subtitle`, `items[]`, `moreAction`

### `StatsSection`

- 接收 `items[]`

### `FinalCtaSection`

- 接收 `title`, `subtitle`, `action`

### `LandingFooter`

- 接收 `brandSummary`, `columns[]`, `socials[]`

这样你复用的是“结构接口”，而不是绑定简历业务本身。

## 11. 一份可直接照着搭的线框

```text
[Sticky Header]
Logo | Nav 1 Nav 2 Nav 3 | Secondary | Primary CTA

[Hero]
Badge
Big headline
2-4 lines supporting copy
[Primary CTA] [Secondary CTA]
[3 visual proof cards / 1 hero product frame]

[Features]
Section title + subtitle
[Tab 1] [Tab 2] [Tab 3] [Tab 4]
+----------------------+----------------------+
| Interactive demo     | Feature title        |
| / mock / animation   | 2-3 lines copy       |
|                      | optional bullet      |
+----------------------+----------------------+

[Showcase]
Section title + subtitle
[Card] [Card] [Card] [Card]
View all

[Stats]
12+    50k+    99.9%    24/7
Label  Label   Label    Label

[CTA]
Large headline
Short reassurance
[Primary CTA]

[Footer]
Brand summary | Product | Resources | Legal
```

## 12. 最后给你的复用建议

如果你要把这套 landing 用到别的项目里，优先复用的是：

- 区块顺序
- 栅格和留白
- 卡片语言
- 动效强度
- CTA 层级
- 背景分层方法

优先替换的是：

- 标题文案
- 演示内容
- 展示卡片内容
- 数字背书内容
- CTA 行为
- 辅助信任元素

一句话概括：复用“页面编排和视觉系统”，替换“业务表达和内容资产”。
