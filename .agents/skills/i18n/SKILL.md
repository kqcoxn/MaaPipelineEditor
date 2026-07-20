---
name: i18n
description: Editor UI internationalization with minimal structural impact. Use when adding or migrating translated strings, locale settings, antd ConfigProvider locale, react-i18next setup, or preparing merge-friendly i18n PRs for upstream (Chinese default).
---

# Editor i18n（最小侵入）

为 MaaPipelineEditor **前端 Editor** 引入 UI 多语言时的决策与实施指南。目标：**默认中文不变**、**增量迁移**、**便于合并回上游中文仓库**。

> 与 MaaFramework ProjectInterface V2 的 `languages` / `$` 前缀国际化无关；本 skill 仅覆盖 Editor React UI。

## 适用范围

| 范围 | 是否纳入 |
|------|----------|
| `Editor/` React UI 文案 | ✅ |
| antd 组件内置文案（日期、空状态等） | ✅ 通过 `ConfigProvider locale` |
| `LocalBridge` / `Desktop` | ❌ 除非 UI 在此展示 |
| `DocumentStation` VitePress | ❌ 独立站点，另议 |
| PI V2 协议字段国际化 | ❌ 见 `maafw` skill |

## 核心原则

1. **中文为默认与 fallback** — `fallbackLng: 'zh-CN'`；未翻译 key 仍显示中文。
2. **增量迁移** — 禁止一次性全仓库替换字符串；按 panel / modal 分批 PR。
3. **additive 优先** — 新增 `Editor/src/i18n/` 目录；尽量少改现有模块结构。
4. **合并友好** — 使用语义化 key + **defaultValue 保留原中文**；不把全部中文搬到 `zh-CN.json`。
5. **翻译文件外置** — `en-US.json`、`th-TH.json` 等由 fork 维护；上游可不维护非中文 locale。

## 目录结构（目标态）

```
Editor/src/i18n/
  index.ts           # i18next 初始化、与 configStore.uiLocale 同步
  antdLocales.ts     # antd locale 映射
  locales/
    en-US.json
    th-TH.json
    zh-CN.json       # 可选；默认可不建，依赖 fallback + defaultValue
```

**仅允许少量触点修改既有文件：**

| 文件 | 变更 |
|------|------|
| `Editor/src/main.tsx` 或 `App.tsx` | `import './i18n'`；根级 `ConfigProvider locale` |
| `Editor/src/stores/configStore.ts` | 新增 `uiLocale`，写入现有 localStorage 缓存 |
| `Editor/src/components/panels/settings/settingsDefinitions.ts` | 新增「界面语言」配置项（可选） |

其余文件仅在迁移该模块文案时引入 `useTranslation`。

## 技术选型

- **库**：`i18next` + `react-i18next`
- **包管理**：`yarn`（在 `Editor/` 下安装）
- **antd**：根级 `ConfigProvider` + `antd/locale/*`（与 `uiLocale` 联动）

初始化要点：

```ts
i18n.init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  resources: { /* en-US, th-TH, ... */ },
  interpolation: { escapeValue: false },
});
```

## 字符串写法（合并友好）

### ✅ 推荐：语义 key + defaultValue（原中文）

```tsx
const { t } = useTranslation();

locale={{ emptyText: t('adb.noDevices', '暂无设备,请点击刷新') }}
```

- 上游改中文：合并时更新 **defaultValue** 与 **en/th JSON**。
- 未提供翻译：fallback 显示 defaultValue / 中文。

### ✅ key 命名

- 格式：`{区域}.{组件}.{含义}`，如 `connection.adb.empty`、`settings.ai.apiKey.label`
- 小写 camelCase 段，用 `.` 分层；与文件路径弱关联即可。

### ❌ 避免

| 做法 | 原因 |
|------|------|
| 用中文当 key：`t('暂无设备...')` | diff 难读，上游改字即改 key |
| 一次性迁入 `zh-CN.json` | 与上游改中文高频冲突 |
| 全量改 `settingsDefinitions.ts` | 体量大，首期勿动 |
| 无 defaultValue 的裸 key | 缺翻译时出现 key 字符串 |

### 非组件场景

- **Zustand / 工具函数**：在调用方 `t()` 后传入，或接受 `TFunction` 参数；避免在 store 顶层硬依赖 i18n（除 `uiLocale` 配置）。
- **动态拼接**：用 i18next 插值 `t('key', { count, name })`，勿拆成多段字符串拼接。

## antd 集成

在 `App.tsx`（或等价根组件）**单层**包裹：

```tsx
import { ConfigProvider } from 'antd';
import { getAntdLocale } from '@/i18n/antdLocales';

<ConfigProvider locale={getAntdLocale(uiLocale)}>
  {/* 现有 App */}
</ConfigProvider>
```

- 子组件内已有 `ConfigProvider`（如 `NewcomerGuideModal`）可嵌套，勿重复造全局第二套。
- `List` 的 `locale.emptyText` 等业务文案仍用 `t()`，与 antd 内置 locale 分工明确。

## 配置与持久化

- 在 `ConfigState['configs']` 增加 `uiLocale: 'zh-CN' | 'en-US' | 'th-TH' | ...`
- 复用 `saveConfigCache` / localStorage 现有机制
- 切换语言时：`i18n.changeLanguage(uiLocale)` + 触发 antd locale 更新

## 迁移阶段（PR 拆分）

详见 [references/migration-phases.md](references/migration-phases.md)。

| 阶段 | 内容 | 对用户可见变化 |
|------|------|----------------|
| PR1 | 依赖 + `i18n/` + init + `ConfigProvider` + `uiLocale` | 默认无（仍为中文） |
| PR2 | Header、语言切换、空状态列表（Connection 等） | 可选切换语言 |
| PR3+ | Settings 外各 panel、modals、debug | 逐步覆盖 |

**首期禁止**：整文件翻译 `settingsDefinitions.ts`（700+ 行声明式中文）。

## 合并回上游策略

1. **PR1 仅基础设施** — 易获上游接受；默认行为与现网一致。
2. **说明文档**：非中文 locale 由 fork 维护，上游零负担。
3. **`t()` 包裹**：每个 defaultValue 保留原中文，便于三方合并。
4. **若上游拒绝 i18n**：fork 保留 `i18n` 分支；或按模块 revert `t()` 包裹，保留 infra。

## Agent 实施检查清单

- [ ] 新文案是否使用 `t(key, defaultValue)` 而非硬编码（已迁移区域）
- [ ] key 是否语义化且唯一
- [ ] `en-US` / `th-TH` 是否已补词条（迁移区域）
- [ ] 是否只改目标模块，未顺手全库替换
- [ ] 根 `ConfigProvider locale` 是否随 `uiLocale` 更新
- [ ] 是否未改动 LocalBridge / Desktop / 协议层

## 参考

- 迁移阶段与文件优先级：[references/migration-phases.md](references/migration-phases.md)
- 项目结构：[AGENTS.md](../../../AGENTS.md)
- antd locale：[ant-design skill](../ant-design/SKILL.md)
