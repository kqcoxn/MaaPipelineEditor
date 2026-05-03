# Wiki Docsite Migration P0 Checklist

状态：Frozen  
日期：2026-05-03  
适用阶段：P0 文档治理落地  
关联总纲：`dev/design/wiki-docsite-migration-prd.md`

## 1. 使用说明

- 本文档是 P0 的执行附件，不替代总纲 PRD。
- P0 仅冻结到模块级清单，不在本文档提前写死最终 `Step` 文案。
- 本文档不授权修改 `src/`、`LocalBridge/`、`docsite/docs/`；任何运行时代码变更都属于 P1 及以后。

## 2. 页面分流矩阵

| 来源路径 | 内容区域 | 归属类型 | 目标 Wiki Entry | 目标 Wiki Module | 保留 docsite 长文 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `docsite/docs/index.md` | 门户层 | `Portal` | - | - | 是 | 外部站首页，保留站点分发入口，不迁入 Modal。 |
| `docsite/docs/01.指南/目录.md` | 门户层 | `Portal` | - | - | 是 | 外部目录页，Wiki 首页另行设计。 |
| `docsite/docs/01.指南/01.开始/01.介绍.md` | 开始 | `Docsite First` | `start` | `认识 MPE` | 是 | Wiki 仅保留一句话定位与跳转。 |
| `docsite/docs/01.指南/01.开始/02.快速上手.md` | 开始 | `Hybrid` | `start` | `5 分钟上手` | 是 | 拆为上手、认识界面、第一次导入导出等模块来源。 |
| `docsite/docs/01.指南/01.开始/10.产品矩阵.md` | 开始 | `Hybrid` | `start` | `版本选择` | 是 | Wiki 仅保留如何选择使用形态的摘要。 |
| `docsite/docs/01.指南/10.工作流面板/10.概述.md` | 工作流面板 | `Wiki First` | `workflow` | `认识工作流编辑器` | 否 | 作为工作流总览模块来源。 |
| `docsite/docs/01.指南/10.工作流面板/20.节点.md` | 工作流面板 | `Wiki First` | `workflow` | `节点` | 否 | 高优先内容，含节点右键与调试入口。 |
| `docsite/docs/01.指南/10.工作流面板/30.字段面板.md` | 工作流面板 | `Wiki First` | `workflow` | `字段面板` | 否 | 计划挂到字段面板上下文入口。 |
| `docsite/docs/01.指南/10.工作流面板/35.节点模板面板.md` | 工作流面板 | `Wiki First` | `workflow` | `节点模板` | 否 | 计划挂到节点模板面板与字段模板相关区域。 |
| `docsite/docs/01.指南/10.工作流面板/40.连接.md` | 工作流面板 | `Wiki First` | `workflow` | `连接面板与连接操作` | 否 | 计划挂到连接面板。 |
| `docsite/docs/01.指南/10.工作流面板/50.文件与视口.md` | 工作流面板 | `Wiki First` | `workflow` | `文件与视口` | 否 | 聚焦文件切换、视口、前缀等操作。 |
| `docsite/docs/01.指南/10.工作流面板/60.工具.md` | 工作流面板 | `Wiki First` | `workflow` | `工具与搜索` | 否 | 仅保留编辑器内高频工具，AI/调试部分分别流向对应 Entry。 |
| `docsite/docs/01.指南/10.工作流面板/80.Pipeline 面板.md` | 工作流面板 | `Wiki First` | `workflow` | `Pipeline 面板` | 否 | 计划挂到 Pipeline 面板。 |
| `docsite/docs/01.指南/10.工作流面板/90.导入与导出.md` | 工作流面板 | `Wiki First` | `workflow` | `导入与导出` | 否 | 计划挂到导入导出区域。 |
| `docsite/docs/01.指南/20.本地服务/01.概览与部署.md` | 本地服务 | `Hybrid` | `localbridge` | `何时需要 LocalBridge` | 是 | Wiki 只保留何时需要、连接前置条件、入口位置。 |
| `docsite/docs/01.指南/20.本地服务/10.本地文件管理.md` | 本地服务 | `Wiki First` | `localbridge` | `本地文件管理` | 否 | 计划挂到文件面板/文件操作区域。 |
| `docsite/docs/01.指南/20.本地服务/20.字段快捷工具.md` | 本地服务 | `Wiki First` | `toolbox` | `字段快捷工具` | 否 | 将拆为 OCR、模板截图、ROI、偏移、颜色、测距等模块来源。 |
| `docsite/docs/01.指南/20.本地服务/40.流程级调试.md` | 本地服务 | `Wiki First` | `debug` | `调试工作台` | 否 | P1 最高优先级之一。 |
| `docsite/docs/01.指南/20.本地服务/50.AI 服务.md` | 本地服务 | `Hybrid` | `ai` | `AI 辅助` | 是 | Wiki 承接前置条件、用法、排障；长配置留 docsite。 |
| `docsite/docs/01.指南/20.本地服务/100.进阶配置.md` | 本地服务 | `Docsite First` | `localbridge` | `进阶配置入口` | 是 | Wiki 仅保留外链与适用场景说明。 |
| `docsite/docs/01.指南/25.本地一体包/01.概览与部署.md` | 本地一体包 | `Docsite First` | `start` | `本地一体包说明入口` | 是 | 不进入首期 Wiki。 |
| `docsite/docs/01.指南/30.特性/01.编译器.md` | 特性 | `Docsite First` | `workflow` | `编译机制入口` | 是 | 机制说明，Wiki 仅在相关模块做摘要引用。 |
| `docsite/docs/01.指南/30.特性/02.解析器.md` | 特性 | `Docsite First` | `workflow` | `解析机制入口` | 是 | 机制说明，Wiki 仅在相关模块做摘要引用。 |
| `docsite/docs/01.指南/90.迁移/01.导入已有文件.md` | 迁移 | `Wiki First` | `migrate` | `导入已有文件` | 否 | P1 高优先内容，保留统一前缀与自动布局注意事项。 |
| `docsite/docs/01.指南/90.迁移/02.从 YAMaaPE 迁移.md` | 迁移 | `Hybrid` | `migrate` | `从 YAMaaPE 迁移` | 是 | Wiki 保留迁移前提、入口与注意事项。 |
| `docsite/docs/01.指南/100.其他/01.参与开发.md` | 其他 | `Docsite First` | `start` | `参与开发入口` | 是 | 面向开发者，应用内仅做去哪里看。 |
| `docsite/docs/01.指南/100.其他/15.嵌入通信协议.md` | 其他 | `Docsite First` | `start` | `嵌入协议入口` | 是 | 协议长文，不进入 Wiki 主线。 |

## 3. 首批 Wiki 模块级清单

| Wiki Entry | 模块名 | 主要来源页 | 计划入口挂点 | 优先级 | 属于 P1 |
| --- | --- | --- | --- | --- | --- |
| `start` | 认识 MPE | `介绍` | Wiki 首页 / 空画布状态 | P1-B | 是 |
| `start` | 5 分钟上手 | `快速上手` | Wiki 首页 / 首次使用提示 | P1-A | 是 |
| `start` | 版本选择 | `产品矩阵` | Wiki 首页 | P1-B | 是 |
| `start` | 第一次导入与导出 | `快速上手` + `导入与导出` | Wiki 首页 / 导入导出区 | P1-A | 是 |
| `workflow` | 认识工作流编辑器 | `概述` | Wiki 首页 / 空画布状态 | P1-B | 是 |
| `workflow` | 节点 | `节点` | 节点相关区域 / 节点右键后续挂点 | P1-A | 是 |
| `workflow` | 字段面板 | `字段面板` | 字段面板 | P1-A | 是 |
| `workflow` | 节点模板 | `节点模板面板` | 节点模板面板 / 字段模板入口 | P1-B | 是 |
| `workflow` | 连接面板与连接操作 | `连接` | 连接面板 | P1-A | 是 |
| `workflow` | 文件与视口 | `文件与视口` | 文件区域 / 视口相关区域 | P1-B | 是 |
| `workflow` | 工具与搜索 | `工具` | 全局工具栏 / 搜索相关区域 | P1-B | 是 |
| `workflow` | Pipeline 面板 | `Pipeline 面板` | Pipeline 面板 | P1-A | 是 |
| `workflow` | 导入与导出 | `导入与导出` | 导入导出区域 | P1-A | 是 |
| `toolbox` | OCR | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-A | 是 |
| `toolbox` | 模板截图 | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-A | 是 |
| `toolbox` | ROI | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-A | 是 |
| `toolbox` | 偏移测量 | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-A | 是 |
| `toolbox` | 颜色取点 | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-B | 是 |
| `toolbox` | 位移测量 | `字段快捷工具` | 工具箱 / 字段快捷入口 | P1-B | 是 |
| `debug` | 调试工作台 | `流程级调试` | `DebugModal` / 调试入口按钮 | P1-A | 是 |
| `debug` | 调试前置条件 | `流程级调试` + `概览与部署` | `DebugModal` | P1-A | 是 |
| `debug` | 运行方式 | `流程级调试` + `节点` | `DebugModal` / 节点调试入口 | P1-A | 是 |
| `debug` | 时间线与产物 | `流程级调试` | `DebugModal` | P1-B | 否 |
| `debug` | 调试排障 | `流程级调试` | `DebugModal` | P1-B | 否 |
| `localbridge` | 何时需要 LocalBridge | `概览与部署` | 连接状态区 / Wiki 首页 | P1-A | 是 |
| `localbridge` | 连接状态与前置条件 | `概览与部署` | 连接状态区 | P1-B | 否 |
| `localbridge` | 本地文件管理 | `本地文件管理` | 文件面板 | P1-B | 否 |
| `localbridge` | 设备与截图前置 | `概览与部署` + `字段快捷工具` | 截图/工具失败场景 | P1-B | 否 |
| `localbridge` | 常见连接问题 | `概览与部署` | 连接失败场景 | P1-B | 否 |
| `ai` | AI 辅助 | `AI 服务` | AI 预测入口 / AI 历史 | P2-A | 否 |
| `ai` | AI 前置条件 | `AI 服务` | AI 预测入口 | P2-A | 否 |
| `ai` | AI 常见问题 | `AI 服务` | AI 预测入口 / AI 历史 | P2-B | 否 |
| `migrate` | 导入已有文件 | `导入已有文件` | 导入入口 / 旧文件首次打开 | P1-A | 是 |
| `migrate` | 统一前缀与自动布局 | `导入已有文件` | 导入入口 / 旧文件首次打开 | P1-A | 是 |
| `migrate` | 从 YAMaaPE 迁移 | `从 YAMaaPE 迁移` | 导入入口 / 迁移提示 | P1-B | 否 |

说明：

- P1 首批共 18 个模块，满足“12+ 高频模块”的阶段门槛。
- `P1-A` 表示首批必须优先落地；`P1-B` 表示可在 P1 内补完但不阻塞首批闭环；`P2-*` 表示明确后移。

## 4. 上下文入口清单

### 已存在入口

| 入口 | 当前状态 | 已关联内容 | P0 处理 |
| --- | --- | --- | --- |
| `GlobalPanel` | 已恢复可见 | 全局 Wiki 打开能力 | 已在 P1 恢复。 |
| `DebugModal` | 已存在 `WikiPonderTrigger` | `debug/workbench` | P1 已作为调试主挂点恢复。 |
| `ToolboxPanel` | 已存在 `WikiPonderTrigger` | `toolbox/ocr`、`toolbox/template-screenshot`、`toolbox/color-pick`、`toolbox/roi`、`toolbox/roi-offset`、`toolbox/delta-measure` | P1 / P1-B / P1 收尾 已承接工具箱主挂点。 |

### P1 首批必须接入

| 入口 | 目标模块方向 | 原因 |
| --- | --- | --- |
| 字段面板 | `workflow/字段面板`、`toolbox/*` | 高频配置面，直接决定操作闭环。 |
| 连接面板 | `workflow/连接面板与连接操作` | 连接逻辑学习成本高，必须就地说明。 |
| Pipeline 面板 | `workflow/Pipeline 面板` | 文件/本地操作集中区，需要上下文说明。 |
| 导入导出区域 | `workflow/导入与导出`、`migrate/*` | 新用户与迁移用户共同高频入口。 |

### P2 扩展入口

| 入口 | 目标模块方向 | 备注 |
| --- | --- | --- |
| AI 相关区域 | `ai/*` | 等 AI 模块成型后补齐。 |
| 空画布 / 首次使用提示 | `start/*`、`workflow/认识工作流编辑器` | P1 收尾后仍后移，不作为本轮闭环条件。 |
| 旧文件首次打开 / 迁移提示 | `migrate/*` | 仍后移，适合和导入链路一起补齐。 |
| LocalBridge 失败场景 | `localbridge/常见连接问题` | P1-B 已补静态帮助入口；更深的错误联动仍后移。 |

## 5. P1 最小实施边界

- 只做高频操作闭环，不碰安装部署、嵌入协议、参与开发、编译器/解析器、LocalBridge 进阶配置、本地一体包长文。
- 只冻结到 `Entry / Module` 层；`Step` 拆分、关键词细化、`searchText` 优化由 P1 实作时补完。
- `Hybrid` 页面只要求在应用内提供摘要、入口、前置条件、常见问题与外链，不要求两端内容等量。
- 任何未出现在本清单中的新模块，默认不进入 P1 首批范围。

## 6. 风险备注

- 资源路径风险：docsite 中大量媒体依赖 `/docs/` Base；P0 只记录，P1 迁移时必须改成主应用可访问路径。
- 双维护风险：`src/wiki/registry.ts` 与 `src/wiki/searchIndex.ts` 目前均为手工维护；P1 实施时容易漏注册、漏索引。
- 内容漂移风险：`Hybrid` 页面如果摘要与长文边界不清，后续容易双端都改或双端都不改。
- 入口漂移风险：若后续直接在代码里新增入口但不回写本文档，会导致 PRD 与实现脱节。
- 可见性风险：入口已在 P1 恢复；后续风险转为“新增内容是否能维持可发现性和维护一致性”。

## 7. P0 验收结果

- 已覆盖 27 页来源文档，且每页仅出现一次。
- `Portal` 仅用于 `docsite/docs/index.md` 与 `01.指南/目录.md`。
- 所有 `Wiki First` / `Hybrid` 页面都给出了目标 Entry、目标 Module 与至少一个计划入口挂点。
- P1 首批模块数量为 18，满足“12+ 高频模块”的阶段门槛。
- 所有 `Docsite First` 页面都保留了应用内摘要入口或外链角色说明。
- 本阶段未改运行代码、未迁图片、未恢复 Wiki 可见性。

## 8. 后续执行记录

### P1-B 完成事实

- 已补齐 `debug / localbridge / migrate` 的 P1-B 内容模块。
- 已在 `ConnectionPanel`、`LocalFileListPanel`、`ToolboxPanel`、`ImportButton` 接入与 P1-B 模块对应的正式 Wiki 入口。
- `从 YAMaaPE 迁移` 仍保持 `Hybrid` 角色，只做摘要和跳转，不复制 docsite 长文。
- AI 相关区域、旧文件首次打开提示、空画布首次使用提示仍未进入本轮范围。

### P1 收尾完成事实

- 已补齐 `start / workflow / toolbox` 的剩余 P1 模块，P1 内容矩阵闭环完成。
- 已在 `NodeAddPanel`、`SearchPanel`、`FilePanel`、`ToolboxPanel` 接入与剩余模块直接对应的正式 Wiki 入口。
- `WikiModal` 首页已可直接分发到 `认识 MPE` 与 `认识工作流编辑器`。
- 空画布首次使用提示、旧文件首次打开提示、AI 相关区域入口仍明确后移到 P2。
